const RestServer = require('@hkube/rest-server');
const rest = new RestServer();
const fs = require('fs');
const path = require('path');
const swagger = require('./swagger');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContanier();
const componentName = require('../../common/consts/componentNames');
const metrics = require('@hkube/metrics');
const beforeRequest = require('./middlewares/before-request');
const afterRequest = require('./middlewares/after-request');

class AppServer {
    init(options) {
        return new Promise((resolve, reject) => {
            rest.on('error', (res) => {
                log.error('Error response, status=' + res.status + ', message=' + res.error.message, { component: componentName.REST_API });
            });

            const { prefix } = options.rest;
            const routes = [];
            routes.push(metrics.getRouter());
            options.rest.versions.forEach((v) => {
                swagger.servers.push({ url: `/${prefix}${v}` });
                const dir = fs.readdirSync(path.join(__dirname, `/routes/${v}`));
                dir.forEach((f) => {
                    const file = path.basename(f, '.js');
                    routes.push({
                        route: path.join('/', prefix, v, file),
                        router: require(`./routes${v}/${file}`)({ version: v, file })  // eslint-disable-line
                    });
                });
            });

            const { beforeRoutesMiddlewares, afterRoutesMiddlewares } = metrics.getMiddleware();
            const routeLogBlacklist = ['/metrics'];
            swagger.basePath = options.swagger.path;
            const opt = {
                swagger,
                poweredBy: options.rest.poweredBy,
                name: options.serviceName,
                routes,
                prefix,
                port: options.rest.port,
                versions: options.rest.versions,
                beforeRoutesMiddlewares: [...beforeRoutesMiddlewares, beforeRequest(routeLogBlacklist)],
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
