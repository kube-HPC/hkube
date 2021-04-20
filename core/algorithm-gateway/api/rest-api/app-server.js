require('express-async-errors');
const fs = require('fs');
const path = require('path');
const RestServer = require('@hkube/rest-server');
const { swaggerUtils } = require('@hkube/rest-server');
const log = require('@hkube/logger').GetLogFromContainer();
const HttpStatus = require('http-status-codes');
const validator = require('../../lib/validation/api-validator');
const component = require('../../lib/consts/componentNames').REST_API;
const rest = new RestServer();

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

        const swagger = await swaggerUtils.loader.load({ path: path.join(__dirname, 'swagger') });
        swagger.info.version = options.version;

        const { port, poweredBy } = options.rest;
        const routes = [];
        const routers = fs.readdirSync(path.join(__dirname, 'routes'));

        routers.forEach((r) => {
            swagger.servers.push({ url: path.join('/', options.swagger.path) });
            const file = path.basename(r, '.js');
            routes.push({
                route: path.join('/', file),
                router: require('./' + path.join('routes', file))()  // eslint-disable-line
            });
        });

        await swaggerUtils.validator.validate(swagger);
        validator.init(swagger.components.schemas);

        // TODO: handle bodyParser.raw
        const opt = {
            swagger,
            routes,
            poweredBy,
            port: parseInt(port, 10),
            name: options.serviceName,
        };
        const data = await rest.start(opt);
        log.info(`🚀 ${data.message}`, { component });
    }
}

module.exports = new AppServer();
