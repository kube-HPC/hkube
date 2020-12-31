const innerValidator = require('./inner-validator');
const DataSources = require('./dataSources');
const Snapshots = require('./snapshots');

class ApiValidator {
    constructor() {
        /** @type {DataSources} */
        this.dataSources = null;
        /** @type {Snapshots} */
        this.snapshots = null;
    }

    init(schemas, schemasInternal) {
        innerValidator.init(schemas, schemasInternal);
        this.dataSources = new DataSources(innerValidator);
        this.snapshots = new Snapshots(innerValidator);
    }
}

module.exports = new ApiValidator();
