
const RestServer = require('@hkube/rest-server');
const Logger = require('@hkube/logger');
const component = require('../lib/consts/componentNames').REST_API;
const router = require('./routes/algorithm');

let log;
const rest = new RestServer();

class AppServer {
    init(options) {
        return new Promise((resolve, reject) => {
            log = Logger.GetLogFromContanier();
            rest.on('error', (data) => {
                log.error(`Error response, status=${data.status}, message=${data.error.message}`, { component });
            });
            const { prefix, port, rateLimit, poweredBy } = options.rest;
            const opt = {
                routes: [{
                    route: prefix,
                    router: router(options)
                }],
                prefix,
                port: parseInt(port, 10),
                rateLimit,
                poweredBy,
                name: options.serviceName
            };
            rest.start(opt).then((data) => {
                log.info(data.message, { component });
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
    }
}

module.exports = new AppServer();
