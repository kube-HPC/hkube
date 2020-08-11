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
 * (req msgPer sec / res msgPer sec) = ratio
 * (300 / 120) = 2.5
 * If the response is 2.5 times slower than request
 * So we need to scale up current replicas * 2.5
 * If the ratio is 0.5 we need to scale down.
 * The desired ratio is approximately 1 (0.8 <= desired <= 1.2)
 */
const reqResRatioMetric = (data) => {
    const reqRate = _calcRate(data.requests);
    let resRate = _calcRate(data.responses);
    let durationsRatio;

    if (data.responses.length > 0 && data.durations.length > 0) {
        const median = _median(data.durations);
        const durationsRate = 1 / (median / 1000); // msg per sec
        durationsRatio = reqRate / durationsRate;
    }
    if (!reqRate && !resRate) {
        return { ratio: 0, reqRate, resRate };
    }
    if (!resRate) {
        resRate = reqRate / 2;
    }
    const reqResRatio = reqRate / resRate;
    return { reqResRatio, durationsRatio, reqRate, resRate };

    // (0.8 <= reqResRatio <= 1.2) && durationsRatio < 1
};

module.exports = {
    reqResRatioMetric
};
