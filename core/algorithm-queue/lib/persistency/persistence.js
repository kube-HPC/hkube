const log = require('@hkube/logger').GetLogFromContainer();
const scoring = require('./scoring');
const db = require('./db');
const component = require('../consts/component-name').PERSISTENCY;

const LOG_TOPICS = {
    StartSavingScores: 'start saving scores',
    FinishSavingScores: 'finish saving scores',
    ErrorSavingScores: 'error saving scores',
};

class Persistence {
    constructor({ algorithmName, maxScoringSize }) {
        this._algorithmName = algorithmName;
        this._maxScoringSize = maxScoringSize;
        this._prevDataLength = null;
        this._prevPendingAmount = null;
    }

    async store({ data, pendingAmount }) {
        if (this._prevDataLength === 0 && data.length === 0 && this._prevPendingAmount === pendingAmount) {
            return;
        }
        this._prevDataLength = data.length;
        this._prevPendingAmount = pendingAmount;

        await scoring.store({
            key: this._algorithmName,
            data,
            pendingAmount,
            maxSize: this._maxScoringSize,
            onStart: (...args) => this._onStartScoring(...args),
            onEnd: (...args) => this._onEndScoring(...args),
            onError: (...args) => this._onErrorScoring(...args)
        });
    }

    getTasks() {
        return db.getTasks({ algorithmName: this._algorithmName });
    }

    _onStartScoring({ key, length }) {
        this._log({ level: 'info', action: LOG_TOPICS.StartSavingScores, key, length });
    }

    _onEndScoring({ key, length, timeTook }) {
        this._log({ level: 'info', action: LOG_TOPICS.FinishSavingScores, key, length, timeTook });
    }

    _onErrorScoring({ key, error, length }) {
        this._log({ level: 'error', action: LOG_TOPICS.ErrorSavingScores, key, length, error });
    }

    _log({ level, action, key, length, error, timeTook }) {
        const lengthText = length >= 0 ? ` with length ${length}` : '';
        const errorText = error ? `, error: ${error}` : '';
        const timeText = timeTook ? `, ${timeTook}ms` : '';
        const topic = `${action} for ${key}`;
        const message = `${topic}${lengthText}${timeText}${errorText}`;
        log.throttle[level](message, { component, throttleTopic: topic });
    }
}

module.exports = Persistence;
