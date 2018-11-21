const RestServer = require('@hkube/rest-server');
const Logger = require('@hkube/logger');
const component = require('../../lib/consts/component-name').REST_API;

const rest = new RestServer();
const router = require('./route');

const log = Logger.GetLogFromContanier();
class Rest {
    async init(options) {
        return new Promise((resolve, reject) => {
            const { prefix, port, rateLimit, poweredBy } = options.rest;
            this.opt = {
                port: parseInt(port, 10),
                routes: [{
                    route: prefix,
                    router: router(options)
                }],
                rateLimit,
                poweredBy,
                name: options.serviceName,
            };
            rest.on('error', (data) => {
                //    const { route, jobId, pipelineName } = data.res._internalMetadata || {};
                log.error(`Error response, status=${data.status}`, { component });
            });
            rest.start(this.opt).then((data) => {
                log.info(data.message, { component });
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
    }
}


module.exports = new Rest();
