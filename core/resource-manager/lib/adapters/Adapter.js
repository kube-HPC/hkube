const MIN_CACHE = 1;

class Adapter {
    constructor(options) {
        this.name = options.name;
        this.mandatory = options.setting.mandatory || false;
        this._cacheTTL = options.setting.cacheTTL || 0;
        this._cache = null;
        this._working = false;
    }

    async init() {
        if (this._cacheTTL < 0 || (this._cacheTTL > 0 && this._cacheTTL < MIN_CACHE)) {
            throw new Error(`cache ttl must be at least ${MIN_CACHE} sec`);
        }
        if (this._cacheTTL) {
            await this.updateCache();
            this._runCacheInterval();
        }
    }

    async getData() {
        if (this._cache) {
            return this._cache;
        }
        const data = await this._getData();
        return { data };
    }

    _runCacheInterval() {
        setInterval(async () => {
            if (this._working) {
                return;
            }
            this._working = true;
            await this.updateCache();
            this._working = false;
        }, this._cacheTTL * 1000);
    }

    async updateCache() {
        let data;
        let error;
        try {
            data = await this._getData();
        }
        catch (e) {
            error = e;
        }
        this._cache = { data, error };
    }
}

module.exports = Adapter;
