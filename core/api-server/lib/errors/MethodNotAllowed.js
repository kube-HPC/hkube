const HttpStatus = require('http-status-codes');
const status = HttpStatus.StatusCodes.METHOD_NOT_ALLOWED;

class MethodNotAllowed extends Error {
    constructor() {
        super(HttpStatus.StatusCodes.getStatusText(status));
        this.status = status;
    }
}

module.exports = MethodNotAllowed;
