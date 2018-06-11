const Cache = require('lru-cache');

class CacheProvider {
    constructor(options) {
        if (options.maxAge) {
            const settings = {
                max: 50,
                maxAge: options.maxAge
            };
            this._cacheKey = options.key;
            this._cache = Cache(settings);
        }
    }

    get() {
        if (this._cache) {
            return this._cache.get(this._cacheKey);
        }
        return null;
    }

    set(value) {
        if (this._cache) {
            this._cache.set(this._cacheKey, value);
        }
    }

    del() {
        if (this._cache) {
            this._cache.del(this._cacheKey);
        }
    }
}

module.exports = CacheProvider;
