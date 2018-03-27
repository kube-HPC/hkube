const Cache = require('lru-cache');

class CacheProvider {
    constructor(options) {
        if (options.maxAge) {
            const settings = {
                max: 50,
                dispose: (key, n) => {
                    // console.log(`key ${key} has disposed`);
                },
                maxAge: options.maxAge
            }
            this._cacheKey = options.key;
            this._cache = Cache(settings);
        }
    }

    get() {
        if (this._cache) {
            return this._cache.get(this._cacheKey);
        }
    }

    set(value) {
        if (this._cache) {
            this._cache.set(this._cacheKey, value);
        }
    }
}

module.exports = CacheProvider;