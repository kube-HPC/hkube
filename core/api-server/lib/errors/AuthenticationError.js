const { GraphQLError } = require('graphql');

class AuthenticationError extends GraphQLError {
    constructor(message = 'Unauthorized', status, details = null) {
        super(message, {
            extensions: {
                code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
                status,
                details
            }
        });
    }
}

module.exports = AuthenticationError;
