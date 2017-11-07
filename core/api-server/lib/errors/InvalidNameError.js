/*
 * Created by nassi on 05/09/16.
 */

'use strict';

class InvalidNameError extends Error {
    constructor(resourceName) {
        super(`invalid ${resourceName} name`);
        this.status = 400;
    }
}

module.exports = InvalidNameError;
