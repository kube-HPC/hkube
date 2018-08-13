const algorithmsFlat = require('../store/algorithms-flat');
const algorithmsMap = require('../store/algorithms-map');
const drivers = require('../store/drivers');

const storeTypes = {
    flat: {
        algorithms: algorithmsFlat,
        drivers
    },
    map: {
        algorithms: algorithmsMap,
        drivers
    }
};

class StoreFactory {
    getStores(type) {
        return storeTypes[type];
    }
}

module.exports = new StoreFactory();
