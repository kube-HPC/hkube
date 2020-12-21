const HttpStatus = require('http-status-codes');
const status = HttpStatus.METHOD_NOT_ALLOWED;

class MethodNotAllowed extends Error {
    constructor() {
        super(HttpStatus.getStatusText(status));
        this.status = status;
    }
}

module.exports = MethodNotAllowed;
