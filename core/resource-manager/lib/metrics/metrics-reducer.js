

class MetricsReducer {
    reduce(options) {
        const map = {};
        options.reduce((prev, cur) => {
            cur.data.forEach(c => {
                if (c.alg in prev) {
                    prev[c.alg].pods += c.data.pods * cur.weight
                }
                else {
                    prev[c.alg] = { pods: c.data.pods * cur.weight };
                }
            })
            return prev;
        }, map);

        const results = [];
        Object.entries(map).forEach(([k, v]) => {
            results.push({ alg: k, data: v });
        });
        return results;
    }
}

module.exports = new MetricsReducer();