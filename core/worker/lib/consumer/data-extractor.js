const deep = require('deep-get-set');
const flatten = require('flat');
const clone = require('clone');
const storageManager = require('@hkube/storage-manager');

class DataExtractor {
    async extract(input, storage) {
        const result = clone(input);
        const flatObj = flatten(input);

        const promiseDataExtractors = Object.entries(flatObj).map(async ([objectPath, value]) => {
            if (typeof value === 'string' && value.startsWith('$$')) {
                const key = value.substring(2);
                const link = storage[key];
                let data = null;
                if (Array.isArray(link.storageInfo)) {
                    data = await Promise.all(link.storageInfo.map(a => a && storageManager.get(a)));
                    if (link.path) {
                        data = data.map(d => deep(d, link.path));
                    }
                }
                else {
                    data = await storageManager.get(link.storageInfo);
                    if (link.path) {
                        data = deep(data, link.path);
                    }
                    if (Number.isInteger(link.index)) {
                        data = data[link.index];
                    }
                }
                deep(result, objectPath, data);
            }
        });

        await Promise.all(promiseDataExtractors);
        return result;
    }
}

module.exports = new DataExtractor();
