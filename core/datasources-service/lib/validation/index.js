const innerValidator = require('./inner-validator');
const DataSources = require('./dataSources');
const Snapshots = require('./snapshots');
const Downloads = require('./downloads');

class ApiValidator {
    constructor() {
        /** @type {DataSources} */
        this.dataSources = null;
        /** @type {Snapshots} */
        this.snapshots = null;
        /** @type {Downloads} */
        this.downloads = null;
    }

    init(schemas, schemasInternal) {
        innerValidator.init(schemas, schemasInternal);
        this.dataSources = new DataSources(innerValidator);
        this.snapshots = new Snapshots(innerValidator);
        this.downloads = new Downloads(innerValidator);
    }
}

module.exports = new ApiValidator();
