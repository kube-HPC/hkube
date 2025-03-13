const HttpStatus = require('http-status-codes');

class AuthenticationError extends Error {
    constructor(message = 'Unauthorized', details = null) {
        super(message);
        this.status = HttpStatus.StatusCodes.UNAUTHORIZED;
        this.details = details;
    }
}

module.exports = AuthenticationError;
