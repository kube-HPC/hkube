const RestServer = require('@hkube/rest-server');
const rest = new RestServer();
const fs = require('fs');
const path = require('path');
const swagger = require('./swagger');
const Logger = require('@hkube/logger');
const internal = require('./internal/index');
const log = Logger.GetLogFromContanier();
const componentName = require('../../common/consts/componentNames');
const { metrics } = require('@hkube/metrics');
const afterRequest = require('./middlewares/after-request');

class AppServer {
    init(options) {
        return new Promise((resolve, reject) => {
            rest.on('error', (data) => {
                const { route, jobId, pipelineName } = data.res._internalMetadata || {};
                log.error('Error response, status=' + data.status + ', message=' + data.error.message, { component: componentName.REST_API, route, jobId, pipelineName });
            });

            swagger.info.version = options.version;
            const { prefix, port, rateLimit, poweredBy } = options.rest;
            const routes = [metrics.getRouter(), internal()];
            const versions = fs.readdirSync(path.join(__dirname, 'routes'));
            versions.forEach((v) => {
                swagger.servers.push({ url: path.join('/', options.swagger.path, prefix, v) });
                const routers = fs.readdirSync(path.join(__dirname, 'routes', v));
                routers.forEach((f) => {
                    const file = path.basename(f, '.js');
                    routes.push({
                        route: path.join('/', prefix, v, file),
                        router: require('./' + path.join('routes', v, file))({ version: v, file })  // eslint-disable-line
                    });
                });
            });

            const { beforeRoutesMiddlewares, afterRoutesMiddlewares } = metrics.getMiddleware();
            const routeLogBlacklist = ['/metrics', '/swagger'];

            const opt = {
                swagger,
                routes,
                prefix,
                versions,
                port,
                rateLimit,
                poweredBy,
                name: options.serviceName,
                beforeRoutesMiddlewares,
                afterRoutesMiddlewares: [...afterRoutesMiddlewares, afterRequest(routeLogBlacklist)]
            };
            rest.start(opt).then((data) => {
                resolve({
                    message: data.message,
                    server: data.server
                });
            }).catch((error) => {
                reject(error);
            });
        });
    }
}

module.exports = new AppServer();
