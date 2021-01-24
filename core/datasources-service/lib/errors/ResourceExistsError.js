const HttpStatus = require('http-status-codes');

class ResourceExistsError extends Error {
    constructor(resourceType, resourceName) {
        super(`${resourceType} ${resourceName} already exists`);
        this.status = HttpStatus.CONFLICT;
    }
}

module.exports = ResourceExistsError;
