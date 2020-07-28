const _percentDiff = (first, second) => {
    return Math.abs(first - second) / ((first + second) / 2);
};

const _median = (array) => {
    if (array.length === 0) {
        return 0;
    }
    array.sort();
    const half = Math.floor(array.length / 2);
    const median = array.length % 2 ? array[half] : (array[half - 1] + array[half]) / 2.0;
    return median;
};

const time = (data, metric) => {
    const current = _median(data.durations);
    const ratio = _percentDiff(current, metric.desired);
    return ratio;
};

const queue = (data, metric) => {
    const current = data.currentSize;
    const ratio = _percentDiff(current, data.queueSize);
    return ratio;
};

const sentRate = (data, metric) => {
    if (data.sentList.length < 2) {
        return 0;
    }
    const first = data.sentList[0];
    const last = data.sentList[data.sentList.length - 1];
    const timeDiff = (last.time - first.time) / 1000;
    const countDiff = last.count - first.count;
    const rate = countDiff / timeDiff;
    const ratio = _percentDiff(rate, metric.desired);
    return ratio;
};

module.exports = {
    time,
    queue,
    sentRate
};
