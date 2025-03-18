const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const HttpStatus = require('http-status-codes');
const log = require('@hkube/logger').GetLogFromContanier();
const { AuthenticationError } = require('../../lib/errors');
const component = require('../../lib/consts/componentNames').GRAPHQL_SERVER;
const _typeDefs = require('./graphql-schema');
const _resolvers = require('./resolvers');

/**
 * Builds the GraphQL context, including authentication and role checking.
 */
const buildContext = (req, keycloak) => {
    const user = req.kauth?.grant?.access_token?.content || null;
    const roles = user?.resource_access?.['api-server']?.roles || [];

    // if (!user && keycloak) {
    //     throw new AuthenticationError('Unauthorized: Missing or invalid token', HttpStatus.StatusCodes.UNAUTHORIZED);
    // }

    const checkPermission = (requiredRoles) => {
        if (!keycloak) return true; // Bypass if auth is disabled
        if (!user) throw new AuthenticationError('Unauthorized: Missing or invalid token', HttpStatus.StatusCodes.UNAUTHORIZED);
        if (!requiredRoles || requiredRoles.length === 0) return true; // No role restriction
        return requiredRoles.some(role => roles.includes(role)); // Check if user has a required role
    };

    const context = { roles, checkPermission, ...req };
    // If there's a pre-existing context - merge
    if (req.context) {
        return { ...req.context, ...context };
    }
    return context;
};

/**
 * Apollo Server Plugins for handling errors and lifecycle events.
 */
const getApolloPlugins = () => [
    {
        async requestDidStart() {
            return {
                async willSendResponse({ response }) {
                    if (response.errors?.length > 0) {
                        const status = response.errors[0].nodes?.[0]?.extensions.http.status;
                        response.http.status = status;
                        response.errors = [{
                            message: response.errors[0].message || 'An unexpected error occurred',
                            code: response.errors[0].nodes?.[0]?.extensions?.code || HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
                            status
                        }];
                        delete response.data;
                    }
                },
            };
        },
    },
    {
        async serverWillStart() { // runs when the Apollo Server starts
            return {
                async drainServer() { // a cleanup method that runs when Apollo Server shuts down
                    // subscriptionServer.close();
                }
            };
        }
    }
];

/**
 * Starts the Apollo GraphQL Server.
 */
async function startApolloServer(typeDefs, resolvers, app, httpServer, port, config, keycloak) {
    try {
        const schema = makeExecutableSchema({ typeDefs, resolvers });
        const server = new ApolloServer({
            schema,
            context: ({ req }) => buildContext(req, keycloak),
            plugins: getApolloPlugins(),
            introspection: config.introspection
        });

        await server.start();
        server.applyMiddleware({ app, path: '/graphql' });

        log.info(`🚀 Query endpoint ready at http://localhost:${port}${server.graphqlPath}`, { component });
        log.info(`🚀 Subscription endpoint ready at ws://localhost:${port}${server.graphqlPath}`, { component });
    }
    catch (error) {
        log.error(`Failed to start GraphQL server: ${error.message || error}`, { component });
    }
}

/**
 * Initializes the GraphQL server.
 */
const graphqlServer = (app, httpServer, port, config, keycloak) => {
    startApolloServer(_typeDefs, _resolvers.getResolvers(), app, httpServer, port, config, keycloak).catch(err => {
        log.error(`GraphQL server error: ${err.message || err}`, { component });
    });
};

module.exports = graphqlServer;
