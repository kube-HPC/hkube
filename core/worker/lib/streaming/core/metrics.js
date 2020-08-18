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

/**
* Ratio example:
* ratio = (req msgPer sec / res msgPer sec)
* (300 / 120) = 2.5
* If the response is 2.5 times slower than request
* So we need to scale up current replicas * 2.5
* If the ratio is 0.5 we need to scale down.
* The desired ratio is approximately 1 (0.8 <= desired <= 1.2)
*/
const calcRates = (data) => {
    const reqRate = _calcRate(data.requests.items);
    const resRate = _calcRate(data.responses.items);
    let durationsRate = 0;

    if (data.durations.items.length > 0) {
        const median = _median(data.durations.items) / 1000;
        if (median) {
            durationsRate = 1 / median; // (msg per ~sec)
        }
    }
    return { reqRate, resRate, durationsRate };
};

module.exports = {
    calcRates
};
