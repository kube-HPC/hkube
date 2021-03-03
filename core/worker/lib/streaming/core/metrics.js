const { mean } = require('@hkube/stats');

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
    const rates = (rate1 && rate2) ? (rate1 / rate2) : 0;
    const ratio = Math.ceil(rates);
    return ratio;
};

const _totalCount = (list) => {
    const last = list[list.length - 1];
    return last?.count || 0;
};

const _calcDurations = (list) => {
    let durationsRate = 0;
    const durations = mean(list);
    if (durations) {
        durationsRate = 1 / (durations / 1000);
    }
    return durationsRate;
};

const formatNumber = (num) => {
    return parseFloat(num.toFixed(2));
};

/**
 * This method calculates the rates and totals by looking at
 * statistics inside the fixed window.
 * rates are actually msg per sec.
 * - reqRate: Δ count / Δ time
 * - resRate: Δ count / Δ time
 * - durationsRate: 1 / durations mean
 * - Δ = last item in window - first item in window
 *
 * totals:
 * - totalRequests: last item in requests window.
 * - totalResponses: last item in responses window.
*/
const calcRates = (data) => {
    const reqRate = _calcRate(data.requests.items);
    const resRate = _calcRate(data.responses.items);
    const totalRequests = _totalCount(data.requests.items);
    const totalResponses = _totalCount(data.responses.items);
    const durationsRate = _calcDurations(data.durations.items);
    const grossDurationsRate = _calcDurations(data.grossDurations.items);
    const throughput = reqRate && resRate ? formatNumber((resRate / reqRate) * 100) : 0;
    const processingTime = mean(data.durations.items);
    const roundTripTime = mean(data.grossDurations.items);
    const { queueSize, dropped } = data;
    return { reqRate, resRate, durationsRate, grossDurationsRate, processingTime, roundTripTime, throughput, queueSize, totalRequests, totalResponses, dropped };
};

module.exports = {
    calcRates,
    calcRatio,
    formatNumber
};
