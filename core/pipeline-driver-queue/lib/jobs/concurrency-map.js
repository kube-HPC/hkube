class ConcurrencyMap {
    constructor() {
        this._map = {};
    }

    mapActiveJobs(jobs) {
        jobs.forEach((p) => {
            if (!this._map[p.name]) {
                this._map[p.name] = 0;
            }
            this._map[p.name] += 1;
        });
    }

    disableMaxExceeded(pipeline) {
        if (pipeline.concurrency) {
            let active = this._map[pipeline.name] || 0;
            if (active < pipeline.concurrency.max) {
                active += 1;
                pipeline.concurrency.maxExceeded = false; // eslint-disable-line
                this._map[pipeline.name] = active;
            }
        }
    }
}

module.exports = new ConcurrencyMap();
