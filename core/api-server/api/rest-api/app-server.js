const RestServer = require('rest-server.hkube');
const rest = new RestServer();
const fs = require('fs');
const path = require('path');
const swagger = require('api/rest-api/swagger');
const Logger = require('logger.hkube');
const log = Logger.GetLogFromContanier();
const componentName = require('common/consts/componentNames');
const { metricsRoute, beforeRouteMiddleware, afterRouteMiddleware } = require('./routes/metrics/metrics');

class AppServer {

  init(options) {
    return new Promise((resolve, reject) => {
      rest.on('error', (res) => {
        log.error('Error response, status=' + res.status + ', message=' + res.error.message, { component: componentName.REST_API });
      });

      const prefix = options.rest.prefix;
      const routes = [];
      routes.push({ route: '/metrics', router: metricsRoute() });
      for (const v of options.rest.versions) {
        fs.readdirSync(__dirname + `/routes/${v}`).forEach(f => {
          const file = path.basename(f, '.js');
          routes.push({
            route: path.join('/', prefix, v, file),
            router: require(`./routes${v}/${file}`)({ version: v, file: file })
          },
          );
        })
      }

      swagger.host = options.swaggerPath.host + ':' + options.swaggerPath.port;
      swagger.basePath = options.swaggerPath.path;

      const beforeRoutesMiddlewares = [
        beforeRouteMiddleware()
      ];
      const afterRoutesMiddlewares = [
        afterRouteMiddleware()
      ];

      const opt = {
        swagger: swagger,
        poweredBy: options.rest.poweredBy,
        name: options.serviceName,
        routes: routes,
        prefix: prefix,
        port: options.rest.port,
        versions: options.rest.versions,
        beforeRoutesMiddlewares: beforeRoutesMiddlewares,
        afterRoutesMiddlewares: afterRoutesMiddlewares
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
