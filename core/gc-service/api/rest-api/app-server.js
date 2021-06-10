const fs = require('fs-extra');
const path = require('path');
const RestServer = require('@hkube/rest-server');
const { swaggerUtils } = require('@hkube/rest-server');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../lib/consts/componentNames').REST_API;
const rest = new RestServer();

class AppServer {
    async init(options) {
        rest.on('error', (data) => {
            const error = data.error || data.message || {};
            const status = data.status || data.code;
            log.info(`status=${status}, message=${error}`, { component });
        });

        const swagger = await swaggerUtils.loader.load({ path: path.join(__dirname, 'swagger') });
        swagger.info.version = options.version;

        const { port, prefix, bodySizeLimit, poweredBy } = options.rest;
        const routes = [];
        const routers = await fs.readdir(path.join(__dirname, 'routes'));

        routers.forEach((r) => {
            swagger.servers.push({ url: path.join('/', options.swagger.path, prefix) });
            const file = path.basename(r, '.js');
            routes.push({
                route: path.join('/', prefix, file),
                router: require('./' + path.join('routes', file))()  // eslint-disable-line
            });
        });

        await swaggerUtils.validator.validate(swagger);

        const opt = {
            swagger,
            routes,
            bodySizeLimit,
            poweredBy,
            port: parseInt(port, 10),
            name: options.serviceName,
        };
        const data = await rest.start(opt);
        log.info(`🚀 ${data.message}`, { component });
    }
}

module.exports = new AppServer();
