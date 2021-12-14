const fse = require('fs-extra');
const path = require('path');
const RestServer = require('@hkube/rest-server');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../lib/consts/component-name').REST_API;
const rest = new RestServer();
const routeLogBlacklist = ['/metrics'];

class AppServer {
    async init(options) {
        rest.on('error', (data) => {
            const error = data.error || data.message || {};
            const status = data.status || data.code;
            log.info(`status=${status}, message=${error}`, { component });
        });

        const { port, prefix, bodySizeLimit, poweredBy } = options.rest;

        const routes = [];
        const routers = await fse.readdir(path.join(__dirname, 'routes'));
        routers.forEach((r) => {
            const file = path.basename(r, '.js');
            routes.push({
                route: path.join('/', prefix, file),
                router: require('./' + path.join('routes', file))()  // eslint-disable-line
            });
        });

        const opt = {
            routes,
            bodySizeLimit,
            poweredBy,
            port: parseInt(port, 10),
            name: options.serviceName,
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
