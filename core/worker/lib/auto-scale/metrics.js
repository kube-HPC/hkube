const diff = (first, second) => {
    return Math.abs(first - second) / ((first + second) / 2);
};

const time = (data, metric) => {
    const current = data.duration || metric.defaultValue;
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
