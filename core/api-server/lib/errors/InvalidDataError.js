const HttpStatus = require('http-status-codes');

class InvalidDataError extends Error {
    constructor(message) {
        super(message);
        this.status = HttpStatus.StatusCodes.BAD_REQUEST;
    }
}

module.exports = InvalidDataError;
