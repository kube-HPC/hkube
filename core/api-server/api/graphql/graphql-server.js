const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const log = require('@hkube/logger').GetLogFromContanier();
const component = require('../../lib/consts/componentNames').GRAPHQL_SERVER;

const _typeDefs = require('./graphql-schema');
const _resolvers = require('./resolvers');

async function startApolloServer(typeDefs, resolvers, app, httpServer, port, config, keycloak) {
    try {
        const schema = makeExecutableSchema({
            typeDefs,
            resolvers
        });

        if (keycloak) app.use('/graphql', keycloak._keycloak.middleware());

        const server = new ApolloServer({
            schema,
            context: ({ req }) => {
                const authHeader = req.headers.authorization || '';
                const user = req.kauth?.grant?.access_token?.content || null; // Extract user info

                const context = {
                    authHeader,
                    user,
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
