
const RestServer = require('@hkube/rest-server');
const Logger = require('@hkube/logger');
const component = require('../../lib/consts/componentNames').REST_API;
const router = require('./routes/algorithm');

const log = Logger.GetLogFromContanier();
const rest = new RestServer();

class AppServer {
    init(options) {
        return new Promise((resolve, reject) => {
            rest.on('error', (data) => {
                const { route, jobId, pipelineName } = data.res._internalMetadata || {};
                log.error(`Error response, status=${data.status}, message=${data.error.message}`, { component, route, jobId, pipelineName });
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
