const algorithmsFlat = require('../store/algorithms-flat');
const algorithmsMap = require('../store/algorithms-map');
const driversFlat = require('../store/drivers-flat');
const driversMap = require('../store/drivers-map');

const storeTypes = {
    flat: {
        algorithms: algorithmsFlat,
        drivers: driversFlat
    },
    map: {
        algorithms: algorithmsMap,
        drivers: driversMap
    }
};

class StoreFactory {
    getStores(type) {
        return storeTypes[type];
    }
}

module.exports = new StoreFactory();
