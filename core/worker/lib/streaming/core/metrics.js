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

const calcRates = (data) => {
    const reqRate = _calcRate(data.requests.items);
    const resRate = _calcRate(data.responses.items);
    let durationsRate = 0;

    if (data.durations.items.length > 0) {
        const median = _median(data.durations.items) / 1000;
        durationsRate = 1 / median; // (msg per ~sec)
    }
    return { reqRate, resRate, durationsRate };
};

module.exports = {
    calcRates
};
