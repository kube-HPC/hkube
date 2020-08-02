const _median = (array) => {
    if (!array || array.length === 0) {
        return 0;
    }
    array.sort();
    const half = Math.floor(array.length / 2);
    const median = array.length % 2 ? array[half] : (array[half - 1] + array[half]) / 2.0;
    return median;
};

const _calcRate = (list) => {
    let first = list[0];
    if (list.length === 1) {
        first = { time: first.time - 2000, count: 0 };
    }
    const last = list[list.length - 1];
    const timeDiff = (last.time - first.time) / 1000;
    const countDiff = last.count - first.count;
    const rate = countDiff / timeDiff;
    return rate;
};

const durations = (data, metric) => {
    const current = _median(data.durations);
    const ratio = (current / metric.desired);
    return ratio;
};

const queueSize = (data, metric) => {
    const rate = _calcRate(data.queueSize);
    const ratio = (rate / metric.desired);
    return ratio;
};

const sentRate = (data, metric) => {
    const rate = _calcRate(data.sent);
    const ratio = (rate / metric.desired);
    return ratio;
};

module.exports = {
    durations,
    queueSize,
    sentRate
};
