const format = require('string-template');

const keys = {
    REQ_RES: 'based on req/res ratio of {reqResRatio} (min is {minRatioToScaleUp})',
    REQ_ONLY: 'based on no responses and requests rate of {reqRate} msg per sec',
    IDLE_TIME: 'based on no requests and no responses for {time} sec',
    DUR_RATIO: 'based on durations ratio of {durationsRatio} for {time} sec'
};

const createReason = (key, message, args) => {
    if (!args) {
        return key;
    }
    return {
        code: key,
        message: format(message, args)
    };
};

Object.keys(keys).forEach(k => {
    const message = keys[k];
    keys[k] = (args) => createReason(k, message, args);
});

module.exports = keys;
