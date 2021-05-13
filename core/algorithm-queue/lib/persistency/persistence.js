const pathLib = require('path');
const log = require('@hkube/logger').GetLogFromContainer();
const etcd = require('./etcd');
const redisStorage = require('./redis-storage-adapter');
const components = require('../consts/component-name');

class Persistence {
    constructor({ algorithmName }) {
        this._algorithmName = algorithmName;
        this._prevDataLength = null;
        this._prevPendingAmount = null;
        this._path = pathLib.join('/', 'algorithmQueue', algorithmName);
    }

    async store({ data, pendingAmount }) {
        log.debug('storing data to persistency storage', { component: components.ETCD_PERSISTENT });
        if (this._prevDataLength === 0 && data.length === 0 && this._prevPendingAmount === pendingAmount) {
            return;
        }
        log.debug(`writing ${data.length} items to persistency`, { component: components.ETCD_PERSISTENT });
        this._prevDataLength = data.length;
        this._prevPendingAmount = pendingAmount;
        try {
            await redisStorage.put({ data, path: this._path });
        }
        catch (error) {
            log.throttle.error(`failed to store persistency ${error.message}`, { component: components.ETCD_PERSISTENT }, error);
        }

        log.debug(`finished writing ${data.length} items to persistency`, { component: components.ETCD_PERSISTENT });
        const scoreArray = data.map(d => d.calculated.score);
        await etcd.updateQueueData({ name: this._algorithmName, data: scoreArray, pendingAmount, timestamp: Date.now() });
    }

    async get() {
        try {
            const ret = await redisStorage.get({ path: this._path });
            return ret;
        }
        catch (error) {
            log.warning('failed to get queue persistency', { component: components.ETCD_PERSISTENT }, error);
            return [];
        }
    }

    _delete() {
        return redisStorage._delete({ path: this._path });
    }
}

module.exports = Persistence;
