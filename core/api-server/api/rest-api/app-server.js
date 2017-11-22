/*
 * Created by nassi on 15/10/15.
 * This module initialize the express app server
 * including settings, middleware and routes.
 */

const RestServer = require('rest-server.hkube');
const rest = new RestServer();
const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');
//const versionHelper = require('common').VersionHelper;
const Logger = require('logger.hkube');
const log = Logger.GetLogFromContanier();
const componentName = require('common/consts/componentNames');

class AppServer {

  init(options) {
    return new Promise((resolve, reject) => {
      rest.on('error', (res) => {
        log.error('Error response, status=' + res.status + ', message=' + res.error.message, { component: componentName.REST_API });
      });

      const prefix = options.rest.prefix;
      const routes = [];
      //routes.push({ route: '/metrics', router: require('./routes/metrics/metrics')() });
      for (const v of options.rest.versions) {
        routes.push(
          { route: path.join('/', prefix, v, 'exec'), router: require(`./routes${v}/execution`)() },
          { route: path.join('/', prefix, v, 'store'), router: require(`./routes${v}/store`)() }
        );
      }

      const spec = fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8');
      const swagger = jsyaml.safeLoad(spec);

      swagger.host = options.swaggerPath.host + ':' + options.swaggerPath.port;
      swagger.basePath = options.swaggerPath.path;

      const beforeRouteMiddleware = [

      ]

      const opt = {
        swagger: swagger,
        poweredBy: options.rest.poweredBy,
        name: options.serviceName,
        routes: routes,
        prefix: prefix,
        port: options.rest.port,
        versions: options.rest.versions,
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
