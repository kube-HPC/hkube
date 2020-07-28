class Batch {
    async init() {
        return null;
    }

    async finish() {
        return null;
    }

    async enrich(dataToEnrich) {
        return dataToEnrich;
    }
}

module.exports = new Batch();
