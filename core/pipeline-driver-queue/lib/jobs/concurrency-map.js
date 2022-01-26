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

    // disable concurrency limit while active is less than max limit
    checkConcurrencyLimit(job) {
        if (job.concurrency) {
            let active = this._map[job.name] || 0;
            if (active < job.concurrency.max) {
                active += 1;
                this.disableConcurrencyLimit(job);
                this._map[job.name] = active;
            }
        }
    }

    disableConcurrencyLimit(job) {
        job.concurrency.limit = false; // eslint-disable-line
    }
}

module.exports = new ConcurrencyMap();
