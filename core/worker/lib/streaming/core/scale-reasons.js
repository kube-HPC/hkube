const format = require('string-template');

const Codes = {
    REQ_RES: 'REQ_RES',
    REQ_ONLY: 'REQ_ONLY',
    IDLE_TIME: 'IDLE_TIME',
    DUR_RATIO: 'DUR_RATIO'
};

const Messages = {
    [Codes.REQ_RES]: 'based on req/res ratio of {reqResRatio} (min is {minRatioToScaleUp})',
    [Codes.REQ_ONLY]: 'based on no responses and requests rate of {reqRate} msg per sec',
    [Codes.IDLE_TIME]: 'based on no requests and no responses for {time} sec',
    [Codes.DUR_RATIO]: 'based on durations ratio of {durationsRatio} for {time} sec',
};

const createReason = (code, ...args) => {
    const message = Messages[code];
    return {
        code,
        message: format(message, ...args)
    };
};

const ScaleReasonsMessages = {
    [Codes.REQ_RES]: (...args) => createReason(Codes.REQ_RES, ...args),
    [Codes.REQ_ONLY]: (...args) => createReason(Codes.REQ_ONLY, ...args),
    [Codes.IDLE_TIME]: (...args) => createReason(Codes.IDLE_TIME, ...args),
    [Codes.DUR_RATIO]: (...args) => createReason(Codes.DUR_RATIO, ...args)
};

module.exports = {
    ScaleReasonsCodes: Codes,
    ScaleReasonsMessages
};
