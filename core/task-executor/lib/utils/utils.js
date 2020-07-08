const arrayToMap = (array) => {
    const init = Object.create(null);
    return array.reduce((map, obj) => {
        map[obj.name] = obj;
        return map;
    }, init);
};

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
            return cache.data;
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
    arrayToMap,
    cacheResults
};
