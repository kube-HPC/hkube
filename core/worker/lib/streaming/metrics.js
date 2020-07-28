const diff = (first, second) => {
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
    const ratio = diff(current, metric.min);
    return ratio;
};

const queue = (data, metric) => {
    const current = data.currentSize;
    const ratio = diff(current, data.queueSize);
    return ratio;
};

module.exports = {
    time,
    queue
};
