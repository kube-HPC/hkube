const innerValidator = require('./inner-validator');
const Preference = require('./preference');

class ApiValidator {
    constructor() {
        this.preference = null;
    }

    init(schemas) {
        innerValidator.init(schemas);
        this.preference = new Preference(innerValidator);
    }
}

module.exports = new ApiValidator();
