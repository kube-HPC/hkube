const log = require('@hkube/logger').GetLogFromContainer();
const snapshot = require('./snapshot');
const scoring = require('./scoring');
const component = require('../consts/component-name').PERSISTENT;

const LOGS = {
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
    constructor({ algorithmName }) {
        this._algorithmName = algorithmName;
        this._prevDataLength = null;
        this._prevPendingAmount = null;
        this._printThrottleMessages = {
            [LOGS.StartSavingSnapshot]: { delay: 30000, lastPrint: null },
            [LOGS.FinishSavingSnapshot]: { delay: 30000, lastPrint: null },
            [LOGS.ErrorSavingSnapshot]: { delay: 30000, lastPrint: null },

            [LOGS.StartGetSnapshot]: { delay: 30000, lastPrint: null },
            [LOGS.FinishGetSnapshot]: { delay: 30000, lastPrint: null },
            [LOGS.ErrorGetSnapshot]: { delay: 30000, lastPrint: null },

            [LOGS.StartSavingScores]: { delay: 30000, lastPrint: null },
            [LOGS.FinishSavingScores]: { delay: 30000, lastPrint: null },
            [LOGS.ErrorSavingScores]: { delay: 30000, lastPrint: null }
        };
    }

    async store({ data, pendingAmount }) {
        if (this._prevDataLength === 0 && data.length === 0 && this._prevPendingAmount === pendingAmount) {
            return;
        }
        this._prevDataLength = data.length;
        this._prevPendingAmount = pendingAmount;

        await snapshot.store({
            key: this._algorithmName,
            data,
            onStart: (...args) => this._onStartSnapshot(...args),
            onEnd: (...args) => this._onEndSnapshot(...args),
            onError: (...args) => this._onErrorSnapshot(...args)
        });

        await scoring.store({
            key: this._algorithmName,
            data,
            pendingAmount,
            onStart: (...args) => this._onStartScoring(...args),
            onEnd: (...args) => this._onEndScoring(...args),
            onError: (...args) => this._onErrorScoring(...args)
        });
    }

    async get() {
        return snapshot.get({
            key: this._algorithmName,
            onStart: (...args) => this._onStartGetSnapshot(...args),
            onEnd: (...args) => this._onEndGetSnapshot(...args),
            onError: (...args) => this._onErrorGetSnapshot(...args)
        });
    }

    _onStartSnapshot({ key, length }) {
        this._onLog({ level: 'info', action: LOGS.StartSavingSnapshot, key, length });
    }

    _onEndSnapshot({ key, length, timeTook }) {
        this._onLog({ level: 'info', action: LOGS.FinishSavingSnapshot, key, length, timeTook });
    }

    _onErrorSnapshot({ key, length, error }) {
        this._onLog({ level: 'error', action: LOGS.ErrorSavingSnapshot, key, length, error });
    }

    _onStartGetSnapshot({ key, length }) {
        this._onLog({ level: 'info', action: LOGS.StartGetSnapshot, key, length });
    }

    _onEndGetSnapshot({ key, length, timeTook }) {
        this._onLog({ level: 'info', action: LOGS.FinishGetSnapshot, key, length, timeTook });
    }

    _onErrorGetSnapshot({ key, length, error }) {
        this._onLog({ level: 'error', action: LOGS.ErrorGetSnapshot, key, length, error });
    }

    _onStartScoring({ key, length }) {
        this._onLog({ level: 'info', action: LOGS.StartSavingScores, key, length });
    }

    _onEndScoring({ key, length, timeTook }) {
        this._onLog({ level: 'info', action: LOGS.FinishSavingScores, key, length, timeTook });
    }

    _onErrorScoring({ key, error, length }) {
        this._onLog({ level: 'error', action: LOGS.ErrorSavingScores, key, length, error });
    }

    _onLog({ level, action, key, length, error, timeTook }) {
        const lengthText = length >= 0 ? ` with length ${length}` : '';
        const errorText = error ? `, error: ${error}` : '';
        const timeText = timeTook ? `, ${timeTook}ms` : '';
        this._logThrottle(action, level, `${action} for ${key}${lengthText}${timeText}${errorText}`);
    }

    _logThrottle(action, level, message) {
        const setting = this._printThrottleMessages[action];
        let shouldPrint = true;
        if (setting) {
            const { delay, lastPrint } = setting;
            if (lastPrint === null || Date.now() - lastPrint > delay) {
                shouldPrint = true;
                setting.lastPrint = Date.now();
            }
            else {
                shouldPrint = false;
            }
        }
        if (shouldPrint) {
            log[level](message, { component });
        }
    }
}

module.exports = Persistence;
