const flatReducer = require('../reducers/metrics-reducer-flat');
const mapReducer = require('../reducers/metrics-reducer-map');

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
