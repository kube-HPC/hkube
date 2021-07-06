const innerValidator = require('./inner-validator');
const DataSources = require('./dataSources');
const Snapshots = require('./snapshots');
const Downloads = require('./downloads');
const Validation = require('./validation');

class ApiValidator {
    constructor() {
        this.dataSources = null;
        this.snapshots = null;
        this.downloads = null;
        this.validation = null;
    }

    init(schemas) {
        innerValidator.init(schemas);
        this.dataSources = new DataSources(innerValidator);
        this.snapshots = new Snapshots(innerValidator);
        this.downloads = new Downloads(innerValidator);
        this.validation = new Validation(innerValidator);
    }
}

module.exports = new ApiValidator();
