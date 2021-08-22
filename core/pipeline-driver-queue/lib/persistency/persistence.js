const log = require('@hkube/logger').GetLogFromContainer();
const snapshot = require('./snapshot');
const scoring = require('./scoring');
const component = require('../consts/component-name').PERSISTENCY;

const LOG_TOPICS = {
    StartSavingSnapshot: 'start saving snapshot',
    FinishSavingSnapshot: 'finish saving snapshot',
    ErrorSavingSnapshot: 'error saving snapshot',

    StartGetSnapshot: 'start fetching snapshot',
    FinishGetSnapshot: 'finish fetching snapshot',
    ErrorGetSnapshot: 'error fetching snapshot',

    StartSavingScores: 'start saving scores',
    FinishSavingScores: 'finish saving scores',
    ErrorSavingScores: 'error saving scores',
};

class Persistence {
    init(options) {
        this._queueName = options.persistence.type;
    }

    async store(data) {
        await snapshot.store({
            key: this._queueName,
            data,
            onStart: (...args) => this._onStartSnapshot(...args),
            onEnd: (...args) => this._onEndSnapshot(...args),
            onError: (...args) => this._onErrorSnapshot(...args)
        });

        await scoring.store({
            key: this._queueName,
            data,
            onStart: (...args) => this._onStartScoring(...args),
            onEnd: (...args) => this._onEndScoring(...args),
            onError: (...args) => this._onErrorScoring(...args)
        });
    }

    get() {
        return snapshot.get({
            key: this._queueName,
            onStart: (...args) => this._onStartGetSnapshot(...args),
            onEnd: (...args) => this._onEndGetSnapshot(...args),
            onError: (...args) => this._onErrorGetSnapshot(...args)
        });
    }

    _onStartSnapshot({ key, length }) {
        this._log({ level: 'info', action: LOG_TOPICS.StartSavingSnapshot, key, length });
    }

    _onEndSnapshot({ key, length, timeTook }) {
        this._log({ level: 'info', action: LOG_TOPICS.FinishSavingSnapshot, key, length, timeTook });
    }

    _onErrorSnapshot({ key, length, error }) {
        this._log({ level: 'error', action: LOG_TOPICS.ErrorSavingSnapshot, key, length, error });
    }

    _onStartGetSnapshot({ key, length }) {
        this._log({ level: 'info', action: LOG_TOPICS.StartGetSnapshot, key, length });
    }

    _onEndGetSnapshot({ key, length, timeTook }) {
        this._log({ level: 'info', action: LOG_TOPICS.FinishGetSnapshot, key, length, timeTook });
    }

    _onErrorGetSnapshot({ key, length, error }) {
        this._log({ level: 'error', action: LOG_TOPICS.ErrorGetSnapshot, key, length, error });
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

module.exports = new Persistence();
