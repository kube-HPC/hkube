const flatReducer = require('../metrics/metrics-reducer-flat');
const mapReducer = require('../metrics/metrics-reducer-map');

const reducers = {
    flat: flatReducer,
    map: mapReducer
};

class ReducerFactory {
    getReducer(type) {
        return reducers[type];
    }
}

module.exports = new ReducerFactory();
