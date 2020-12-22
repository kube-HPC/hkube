const innerValidator = require('./inner-validator');
const { DataSource } = require('./index');

class ApiValidator {
    init(schemas, schemasInternal) {
        innerValidator.init(schemas, schemasInternal);
        this.dataSource = new DataSource(innerValidator);
    }
}

module.exports = new ApiValidator();
