const orderBy = require('lodash.orderby');
const package = require('../package.json');

const init = async (payload) => {
    console.log(`algorithm: init with input ${JSON.stringify(payload.input)}`);
    this._payload = payload.input;
    return true;
}

const start = async (payload) => {
    console.log(`algorithm: start`);
    const [array, order] = this._payload;
    const result = orderBy(array, null, order);
    return { result, version: package.dependencies["lodash.orderby"] };
}

const stop = async () => {
    console.log('algorithm: stop');
    return true;
}

module.exports = {
    algorithm: {
        lib: {
            init,
            start,
            stop
        }
    }
}