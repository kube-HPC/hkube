class AuthenticationError extends Error {
    constructor(message = 'Unauthorized', status, details = null) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

module.exports = AuthenticationError;
