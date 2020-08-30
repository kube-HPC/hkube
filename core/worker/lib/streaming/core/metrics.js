const Median = (array) => {
    if (!array || array.length === 0) {
        return 0;
    }
    array.sort((a, b) => a - b);
    const half = Math.floor(array.length / 2);
    const median = array.length % 2 ? array[half] : (array[half - 1] + array[half]) / 2.0;
    return median;
};

function Avg(array) {
    if (!array || array.length === 0) {
        return 0;
    }
    const total = array.reduce((acc, c) => acc + c, 0);
    return total / array.length;
}

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

const _totalCount = (list) => {
    const last = list[list.length - 1];
    return (last && last.count) || 0;
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
const CalcRates = (data) => {
    const reqRate = _calcRate(data.requests.items);
    const resRate = _calcRate(data.responses.items);
    const durMedian = Median(data.durations.items);
    const totalRequests = _totalCount(data.requests.items);
    const totalResponses = _totalCount(data.responses.items);
    let durationsRate = 0;

    if (durMedian) {
        const median = 1 / (durMedian / 1000);
        durationsRate = median; // (msg per ~sec)
    }
    return { reqRate, resRate, durationsRate, totalRequests, totalResponses };
};

module.exports = {
    CalcRates,
    Median,
    Avg
};
