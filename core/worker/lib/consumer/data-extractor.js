const deep = require('deep-get-set');
const flatten = require('flat');
const clone = require('clone');
const { isEqual } = require('lodash');
const storageManager = require('@hkube/storage-manager');

class DataExtractor {
    constructor() {
        this.wrappedGetFromStorage = this.wrapStorageGet(); // eslint-disable-line
        this.storageCach = [];
    }

    async extract(input, storage, tracerStart) {
        const result = clone(input);
        const flatObj = flatten(input);
        this.storageCach = this.storageCach || [];
        if (!this.isStorageEqueal(storage, this.oldStorage)) {
            this.storageCach = [];
        }
        this.oldStorage = storage;

        const promiseDataExtractors = Object.entries(flatObj).map(async ([objectPath, value]) => {
            if (typeof value === 'string' && value.startsWith('$$')) {
                const key = value.substring(2);
                const link = storage[key];
                let data = null;
                if (Array.isArray(link.storageInfo)) {
                    data = await Promise.all(link.storageInfo.map(a => a && this.wrappedGetFromStorage(a, tracerStart)));
                    if (link.path) {
                        data = data.map(d => deep(d, link.path));
                    }
                }
                else {
                    data = await this.wrappedGetFromStorage(link.storageInfo, tracerStart);
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

    wrapStorageGet() {
        const getFromStorageWrapper = async (info, trace) => {
            const cached = this.storageCach.find((cachedItem) => {
                return isEqual(info.path, cachedItem.info.path);
            });
            if (cached) {
                return cached.data;
            }
            const data = await storageManager.get(info, trace);
            this.storageCach.push({ info, data });
            return data;
        };
        return getFromStorageWrapper;
    }

    isStorageEqueal(storage1, storage2) {
        if (storage1 && storage2) {
            const links1 = Object.values(storage1).map(s => s.storageInfo.path).sort();
            const links2 = Object.values(storage2).map(s => s.storageInfo.path).sort();
            return isEqual(links1, links2);
        }

        return storage1 === storage2;
    }
}

module.exports = new DataExtractor();
