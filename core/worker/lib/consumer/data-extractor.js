const deep = require('deep-get-set');
const flatten = require('flat');
const clone = require('clone');

class DataExtractor {
    async extract(input, storage, dataProvider) {
        const result = clone(input);
        const flatObj = flatten(input);

        const promiseDataExtractors = Object.entries(flatObj).map(async ([objectPath, value]) => {
            if (typeof value === 'string' && value.startsWith('$$')) {
                const key = value.substring(2);
                const link = storage[key];
                let data = null;
                if (Array.isArray(link.storageInfo)) {
                    data = await Promise.all(link.storageInfo.map(a => a && dataProvider.get(a)));
                    if (link.path) {
                        data = data.map(d => deep(d, link.path));
                    }
                }
                else {
                    data = await dataProvider.get(link.storageInfo);
                    if (Number.isInteger(link.index)) {
                        data = data[link.index];
                    }
                    if (link.path) {
                        data = deep(data, link.path);
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
