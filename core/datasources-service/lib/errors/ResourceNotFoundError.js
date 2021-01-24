const HttpStatus = require('http-status-codes');

class ResourceNotFoundError extends Error {
    constructor(resourceType, resourceName, error) {
        super(`${resourceType} ${resourceName} Not Found`);
        this.status = HttpStatus.NOT_FOUND;
        this.details = error;
    }
}

module.exports = ResourceNotFoundError;
