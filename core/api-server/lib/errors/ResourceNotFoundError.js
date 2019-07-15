const HttpStatus = require('http-status-codes');

class ResourceNotFoundError extends Error {
    constructor(resourceType, resourceName) {
        super(`${resourceType} ${resourceName} Not Found`);
        this.status = HttpStatus.NOT_FOUND;
    }
}

module.exports = ResourceNotFoundError;
