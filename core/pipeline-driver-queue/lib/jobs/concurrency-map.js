class ConcurrencyMap {
    constructor() {
        this._map = {};
    }

    buildActive(jobs) {
        jobs.forEach((p) => {
            if (!this._map[p.name]) {
                this._map[p.name] = 0;
            }
            this._map[p.name] += 1;
        });
    }

    checkMaxExceeded(pipeline) {
        if (pipeline.concurrency) {
            const active = this._map[pipeline.name];
            if (active < pipeline.concurrency.max) {
                pipeline.concurrency.maxExceeded = false;  // eslint-disable-line
            }
        }
    }
}

module.exports = new ConcurrencyMap();
