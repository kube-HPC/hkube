
const Adapter = require('./Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;

class AlgorithmDb extends Adapter {

    constructor(options) {
        super(options);
    }

    getData() {
        return new Promise(function (resolve, reject) {
            log.info(`adapter started`, { component });
            setTimeout(() => {
                const data = [{
                    alg: 'green',
                    cpu: 5
                },
                {
                    alg: 'yellow',
                    cpu: 2
                }]
                resolve(data);
            }, 1000)
        });

    }
}

module.exports = AlgorithmDb;