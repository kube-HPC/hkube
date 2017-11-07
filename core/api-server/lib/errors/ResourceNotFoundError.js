/*
 * Created by nassi on 05/09/16.
 */

'use strict';

class ResourceNotFoundError extends Error {
    constructor(resourceType, resourceName) {
        super(`${resourceType} ${resourceName} Not Found`);
        this.status = 404;
    }
}

module.exports = ResourceNotFoundError;
