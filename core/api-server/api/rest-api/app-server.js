const fs = require('fs');
const path = require('path');
const RestServer = require('@hkube/rest-server');
const Logger = require('@hkube/logger');
const { metrics } = require('@hkube/metrics');
const swagger = require('./swagger');
const internal = require('./internal/index');
const component = require('../../lib/consts/componentNames').REST_API;
const afterRequest = require('./middlewares/after-request');

const log = Logger.GetLogFromContanier();
const rest = new RestServer();

class AppServer {
    init(options) {
        return new Promise((resolve, reject) => {
            rest.on('error', (data) => {
                const { route, jobId, pipelineName } = data.res._internalMetadata || {};
                const { status } = data;
                if (status >= 500) {
                    log.error(`Error response, status=${status}, message=${data.error.message}`, { component, route, jobId, pipelineName, status });
                }
                else {
                    log.info(`status=${status}, message=${data.error.message}`, { component, route, jobId, pipelineName, status });
                }
            });

            swagger.info.version = options.version;
            const { prefix, port, rateLimit, poweredBy } = options.rest;
            const routes = internal();
            routes.push(metrics.getRouter());
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
                port: parseInt(port, 10),
                rateLimit,
                poweredBy,
                name: options.serviceName,
                beforeRoutesMiddlewares,
                afterRoutesMiddlewares: [...afterRoutesMiddlewares, afterRequest(routeLogBlacklist)]
            };
            rest.start(opt).then((data) => {
                log.info(data.message, { component });
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
    }
}

module.exports = new AppServer();
