const HISTOGRAM_OPERATION = {
    start: 'start',
    end: 'end',
    retroActive: 'retroActive'
};

const GAUGE_OPERATION = {
    increase: 'inc',
    decrease: 'dec'
};
const COUNTER_OPERATION = {
    increase: 'inc',
};

const METRICS_KINDS = {
    HISTOGRAM: 'histogram',
    GAUGE: 'gauge',
    COUNTER: 'counter'
};

module.exports = {
    HISTOGRAM_OPERATION,
    GAUGE_OPERATION,
    COUNTER_OPERATION,
    METRICS_KINDS
};
