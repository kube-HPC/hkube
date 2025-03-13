const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const log = require('@hkube/logger').GetLogFromContanier();
const component = require('../../lib/consts/componentNames').GRAPHQL_SERVER;
const AuthenticationError = require('../../lib/errors/AuthenticationError');

const _typeDefs = require('./graphql-schema');
const _resolvers = require('./resolvers');

async function startApolloServer(typeDefs, resolvers, app, httpServer, port, config, keycloak) {
    try {
        const schema = makeExecutableSchema({
            typeDefs,
            resolvers
        });

        const server = new ApolloServer({
            schema,
            context: ({ req }) => {
                const authHeader = req.headers.authorization || '';
                const user = req.kauth?.grant?.access_token?.content || null; // Extract user info

                if (!user && keycloak) {
                    throw new AuthenticationError('Unauthorized: Missing or invalid token');
                }

                const roles = user?.realm_access?.roles || []; // Extract roles from the token

                const checkPermission = (requiredRoles) => {
                    if (!keycloak) return true; // Bypass if auth is disabled
                    if (!requiredRoles || requiredRoles.length === 0) return true; // No role restriction
                    return requiredRoles.some(role => roles.includes(role)); // Check if user has a required role
                };

                const context = {
                    authHeader,
                    user,
                    roles,
                    checkPermission,
                    ...req
                };

                // If there's a pre-existing context - merge
                if (req.context) {
                    return { ...req.context, ...context };
                }
                return context;
            },
            plugins: [{
                async serverWillStart() {
                    return {
                        async drainServer() {
                            // subscriptionServer.close();
                        }
                    };
                }
            }],
            introspection: config.introspection
        });
        await server.start();
        server.applyMiddleware({ app, path: '/graphql' });

        log.info(`🚀 Query endpoint ready at http://localhost:${port}${server.graphqlPath}`, { component });
        log.info(`🚀 Subscription endpoint ready at ws://localhost:${port}${server.graphqlPath}`, { component });
    }
    catch (error) {
        log.error(`Error on running gr ${error}`,);
    }
}

const graphqlServer = (app, httpServer, port, config, keycloak) => {
    startApolloServer(_typeDefs, _resolvers.getResolvers(), app, httpServer, port, config, keycloak).catch(err => {
        log.error(err, { component });
    });
};

module.exports = graphqlServer;
