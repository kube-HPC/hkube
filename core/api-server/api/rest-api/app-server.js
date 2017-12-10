const RestServer = require('@hkube/rest-server');
const rest = new RestServer();
const fs = require('fs');
const path = require('path');
const swagger = require('api/rest-api/swagger');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContanier();
const componentName = require('common/consts/componentNames');
const metrics = require('@hkube/metrics');

class AppServer {

  init(options) {
    return new Promise((resolve, reject) => {
      rest.on('error', (res) => {
        log.error('Error response, status=' + res.status + ', message=' + res.error.message, { component: componentName.REST_API });
      });

      const prefix = options.rest.prefix;
      const routes = [];
      routes.push(metrics.getRouter());
      for (const v of options.rest.versions) {
        swagger.servers.push({ url: `/${prefix}${v}` });
        fs.readdirSync(__dirname + `/routes/${v}`).forEach(f => {
          const file = path.basename(f, '.js');
          routes.push({
            route: path.join('/', prefix, v, file),
            router: require(`./routes${v}/${file}`)({ version: v, file: file })
          }
          );
        })
      }

      // swagger.host = options.swagger.host + ':' + options.swagger.port;
      swagger.basePath = options.swagger.path;

      const opt = {
        swagger,
        poweredBy: options.rest.poweredBy,
        name: options.serviceName,
        routes,
        prefix,
        port: options.rest.port,
        versions: options.rest.versions,
        ...metrics.getMiddleware()
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
