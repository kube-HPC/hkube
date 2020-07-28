const autoScaler = require('../streaming/auto-scaler');
const discovery = require('../streaming/discovery');

class Stream {
    async init(options) {
        await autoScaler.init(options);
    }

    async finish(options) {
        await autoScaler.finish(options);
    }

    async enrich(dataToEnrich, jobData) {
        const { parents } = jobData;
        const addresses = discovery.getAddresses(parents);
        return { ...dataToEnrich, parents: addresses };
    }
}

module.exports = new Stream();
