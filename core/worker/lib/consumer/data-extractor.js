const deep = require('deep-get-set');
const flatten = require('flat');

class DataExtractor {
    async extract(input, storage, dataProvider) {
        const result = input.slice();
        const flatObj = flatten(input);

        const promiseDataExtractors = Object.entries(flatObj).map(async ([objectPath, value]) => {
            if (typeof value === 'string' && value.startsWith('$$')) {
                const key = value.substring(2);
                const link = storage[key];
                let data = null;
                if (Array.isArray(link.accessor)) {
                    data = await Promise.all(link.accessor.map(a => dataProvider.get(a)));
                    if (link.path) {
                        data = data.map(d => deep(d, link.path));
                    }
                }
                else {
                    data = await dataProvider.get(link.accessor);
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
