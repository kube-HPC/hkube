/*
 * Created by nassi on 15/10/15.
 * This module initialize the express app server
 * including settings, middleware and routes.
 */

const RestServer = require('rest-server.rf');
const rest = new RestServer();
const execution = require('./routes/execution');
const store = require('./routes/store');
const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');
//const versionHelper = require('common').VersionHelper;
const Logger = require('logger.rf');
const log = Logger.GetLogFromContanier();
const componentName = require('common/consts/componentNames');

class AppServer {

    init(options) {
        return new Promise((resolve, reject) => {
            const routes = [
                { route: '/', router: execution(options) },
                { route: '/', router: store(options) }
            ];
            rest.on('error', (res) => {
                log.error('Error response, status=' + res.status + ', message=' + res.error.message, { component: componentName.REST_API });
            });

            const spec = fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8');
            const swagger = jsyaml.safeLoad(spec);

            swagger.host = options.swaggerPath.host + ':' + options.swaggerPath.port;
            swagger.basePath = options.swaggerPath.path + '/v1';

            const opt = {
                swagger: swagger,
                name: options.serviceName,
                routes,
                port: options.rest.port
            };
            rest.start(opt).then((data) => {
                //versionHelper(options.serviceName, data.app, log);
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
