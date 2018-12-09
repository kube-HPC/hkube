const orderBy = require('lodash.orderby');
const package = require('../package.json');

const init = async (payload) => {
    console.log('init');
    this._payload = payload;
    return true;
}

const start = async () => {
    console.log('start');
    const [array, order] = this._payload;
    const result = orderBy(array, null, order);
    return { result, version: package.dependencies["lodash.orderby"] };
}

const stop = async () => {
    console.log('stop');
    return true;
}

module.exports = {
    module: {
        lib: {
            init,
            start,
            stop
        }
    }
}