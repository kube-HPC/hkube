const fse = require('fs-extra');
const path = require('path');
const RestServer = require('@hkube/rest-server');
const log = require('@hkube/logger').GetLogFromContanier();
const { metrics } = require('@hkube/metrics');
const HttpStatus = require('http-status-codes');
const internal = require('./internal/index');
const validator = require('../../lib/validation/api-validator');
const component = require('../../lib/consts/componentNames').REST_API;
const rest = new RestServer();
const routeLogBlacklist = ['/metrics', '/swagger'];

class AppServer {
    async init(options) {
        rest.on('error', (data) => {
            const error = data.error || data.message || {};
            const { route, jobId, pipelineName } = (data.res && data.res._internalMetadata) || {};
            const status = data.status || data.code;
            if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
                log.error(`Error response, status=${status}, message=${error}`, { component, route, jobId, pipelineName, httpStatus: status });
            }
            else {
                log.info(`status=${status}, message=${error}`, { component, route, jobId, pipelineName, httpStatus: status });
            }
        });

        const swagger = await fse.readJSON('api/rest-api/swagger.json');
        const { prefix, port, rateLimit, poweredBy, bodySizeLimit } = options.rest;
        const routes = internal();
        routes.push(metrics.getRouter());
        const versions = await fse.readdir(path.join(__dirname, 'routes'));

        await Promise.all(versions.map(async (v) => {
            swagger.servers.push({ url: path.join('/', options.swagger.path, prefix, v) });
            const routers = await fse.readdir(path.join(__dirname, 'routes', v));
            routers.forEach((f) => {
                const file = path.basename(f, '.js');
                routes.push({
                    route: path.join('/', prefix, v, file),
                    router: require('./' + path.join('routes', v, file))({ ...options, version: v, file })  // eslint-disable-line
                });
            });
        }));

        validator.init(swagger.components.schemas);

        const { beforeRoutesMiddlewares, afterRoutesMiddlewares } = metrics.getMiddleware();

        const opt = {
            swagger,
            routes,
            prefix,
            versions,
            port: parseInt(port, 10),
            rateLimit,
            poweredBy,
            bodySizeLimit,
            name: options.serviceName,
            beforeRoutesMiddlewares,
            afterRoutesMiddlewares,
            logger: {
                filterRoutes: routeLogBlacklist,
                onResponse: (data) => {
                    const { method, url, status, duration } = data;
                    log.info(`${method}:${url} ${status} ${duration}ms`, { component, route: url, httpStatus: status });
                }
            }
        };
        const data = await rest.start(opt);
        log.info(`🚀 ${data.message}`, { component });
    }
}

module.exports = new AppServer();
