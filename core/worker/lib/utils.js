const cacheResults = (fn, ttl) => {
    const cache = {
        data: null,
        lastUpdated: null,
        updating: false
    };

    const wrapped = async (...args) => {
        const now = Date.now();
        if (cache.lastUpdated && (now - cache.lastUpdated) < ttl) {
            return cache.data;
        }
        if (cache.updating) {
            return fn(...args);
        }
        cache.updating = true;
        try {
            cache.data = await fn(...args);
            cache.lastUpdated = Date.now();
            return cache.data;
        }
        finally {
            cache.updating = false;
        }
    };
    wrapped._clearCache = () => {
        cache.data = null;
        cache.lastUpdated = null;
        cache.updating = false;
    };
    return wrapped;
};

module.exports = {
    cacheResults
};
