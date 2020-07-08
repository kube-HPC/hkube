class MetricsReducer {
    /**
     * Take each metric and reduce pods calculation
     */
    reduce(metrics) {
        const array = [];
        metrics.forEach((metric) => {
            metric.data = metric.data || [];
            metric.data.forEach((m, i) => {
                const x = array[i];
                const score = x && x.score || 0;
                const met = {
                    ...m,
                    score: m.score * metric.weight + score
                };
                array[i] = met;
                return met;
            });
        });
        return array;
    }
}

module.exports = new MetricsReducer();
