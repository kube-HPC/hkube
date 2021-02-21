const format = require('string-template');

/**
 * These constants represents the scaling reasons.
 * Each decision to scale up or scale down has a reason.
 * reason has code and message.
 */

const Codes = {
    REQ_RES: 'REQ_RES', // scale-up
    REQ_ONLY: 'REQ_ONLY', // scale-up
    IDLE_TIME: 'IDLE_TIME', // scale-down
    DUR_RATIO: 'DUR_RATIO' // scale-down
};

const Messages = {
    [Codes.REQ_RES]: 'based on req/res ratio of {ratio}',
    [Codes.REQ_ONLY]: 'based on no responses and requests rate of {reqRate} msg per sec',
    [Codes.IDLE_TIME]: 'based on no requests and no responses for {time} sec',
    [Codes.DUR_RATIO]: 'based on durations ratio of {ratio} for {time} sec',
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
