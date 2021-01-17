const fs = require('fs');
const path = require('path');
const RestServer = require('@hkube/rest-server');
const { swaggerUtils } = require('@hkube/rest-server');
const log = require('@hkube/logger').GetLogFromContanier();
const { metrics } = require('@hkube/metrics');
require('express-async-errors');
const HttpStatus = require('http-status-codes');
const validator = require('../../lib/validation');
const responseLogger = require('./middlewares/responseLogger');
const component = require('../../lib/consts/componentNames').REST_API;

const rest = new RestServer();

class AppServer {
    async init(options) {
        rest.on('error', data => {
            const error = data.error || data.message || {};
            const { route, jobId, pipelineName } =
                (data.res && data.res._internalMetadata) || {};
            const status = data.status || data.code;
            if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
                log.error(
                    `Error response, status=${status}, message=${error}`,
                    {
                        component,
                        route,
                        jobId,
                        pipelineName,
                        httpStatus: status,
                    }
                );
            } else {
                log.info(`status=${status}, message=${error}`, {
                    component,
                    route,
                    jobId,
                    pipelineName,
                    httpStatus: status,
                });
            }
        });

        const { schemasInternal, ...swagger } = await swaggerUtils.loader.load({
            path: path.join(__dirname, 'swagger'),
        });
        swagger.info.version = options.version;

        const { prefix, port, rateLimit, poweredBy } = options.rest;

        const versions = fs.readdirSync(path.join(__dirname, 'routes'));
        let routes = [];
        versions.forEach(v => {
            swagger.servers.push({
                url: path.join('/', options.swagger.path, prefix, v),
            });
            const routers = fs.readdirSync(path.join(__dirname, 'routes', v));
            routes = routers.map(f => {
                const file = path.basename(f, '.js');
                return {
                    route: path.join('/', prefix, v, file),
                    // eslint-disable-next-line
                    router: require('./' + path.join('routes', v, file))({
                        ...options,
                        version: v,
                        file,
                    }),
                };
            });
        });

        await swaggerUtils.validator.validate(swagger);
        validator.init(swagger.components.schemas, schemasInternal);

        const {
            beforeRoutesMiddlewares,
            afterRoutesMiddlewares,
        } = metrics.getMiddleware();
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
            beforeRoutesMiddlewares: [
                ...beforeRoutesMiddlewares,
                responseLogger(routeLogBlacklist),
            ],
            afterRoutesMiddlewares,
        };
        const data = await rest.start(opt);
        log.info(`🚀 ${data.message}`, { component });
    }
}

module.exports = new AppServer();
