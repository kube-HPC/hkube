const format = require('string-template');

const keys = {
    REQ_RES: 'based on req/res ratio of {reqResRatio} (min is {minRatioToScaleUp})',
    REQ_ONLY: 'based on no responses and requests rate of {reqRate.toFixed(2)} msg per sec',
    IDLE_TIME: 'based on no requests and no responses for {this._config.minTimeIdleBeforeReplicaDown / 1000} sec',
    DUR_RATIO: 'based on durations ratio of {durationsRatio.toFixed(2)} (min is {this._config.minRatioToScaleDown})'
};

const dataxx = (key, data) => {
    return {
        code: key,
        message: format(keys[key], data)
    };
};

const ScaleReasons = {
    REQ_RES: (data) => dataxx('REQ_RES', data),
    REQ_ONLY: (data) => dataxx('REQ_ONLY', data),
    IDLE_TIME: (data) => dataxx('IDLE_TIME', data),
    DUR_RATIO: (data) => dataxx('DUR_RATIO', data)
};

module.exports = ScaleReasons;
