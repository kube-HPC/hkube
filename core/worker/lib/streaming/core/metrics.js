const { median } = require('@hkube/stats');

const _calcRate = (list) => {
    let first = list[0];
    if (list.length === 1) {
        first = { time: first.time - 2000, count: 0 };
    }
    const last = list[list.length - 1];
    const timeDiff = (last.time - first.time) / 1000;
    const countDiff = last.count - first.count;
    let rate = 0;
    if (countDiff && timeDiff) {
        rate = countDiff / timeDiff;
    }
    return rate;
};

const calcRatio = (rate1, rate2) => {
    const ratio = (rate1 && rate2) ? (rate1 / rate2) : 1;
    return ratio;
};

const _totalCount = (list) => {
    const last = list[list.length - 1];
    return (last && last.count) || 0;
};

/**
 * This method calculates the rates and totals by looking at
 * statistics inside the fixed window.
 * rates are actually msg per sec.
 * - reqRate: Δ count / Δ time
 * - resRate: Δ count / Δ time
 * - durationsRate: 1 / durations median
 * - Δ = last item in window - first item in window
 *
 * totals:
 * - totalRequests: last item in requests window.
 * - totalResponses: last item in responses window.
*/
const calcRates = (data) => {
    const reqRate = _calcRate(data.requests.items);
    const resRate = _calcRate(data.responses.items);
    const durMedian = median(data.durations.items);
    const totalRequests = _totalCount(data.requests.items);
    const totalResponses = _totalCount(data.responses.items);
    let durationsRate = 0;

    if (durMedian) {
        durationsRate = 1 / (durMedian / 1000);
    }
    return { reqRate, resRate, durationsRate, totalRequests, totalResponses };
};

module.exports = {
    calcRates,
    calcRatio
};
