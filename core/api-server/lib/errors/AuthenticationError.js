const { GraphQLError } = require('graphql');
const HttpStatus = require('http-status-codes');

class AuthenticationError extends GraphQLError {
    constructor(message = 'Unauthorized', status = HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR) {
        const code = (() => {
            switch (status) {
            case HttpStatus.StatusCodes.FORBIDDEN: return 'FORBIDDEN';
            case HttpStatus.StatusCodes.UNAUTHORIZED: return 'UNAUTHORIZED';
            default: return 'INTERNAL_SERVER_ERROR';
            }
        })();

        super(message, {
            extensions: {
                code,
                http: {
                    status
                }
            },
        });
    }
}

module.exports = AuthenticationError;
