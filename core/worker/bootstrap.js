
process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();

const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const VerbosityPlugin = require('@hkube/logger').VerbosityPlugin;
const monitor = require('@hkube/redis-utils').Monitor;
const componentName = require('common/consts/componentNames');
const discovery = require('lib/states/discovery.js');
const jobConsumer = require('lib/consumer/JobConsumer');
let log;
const worker = require('./lib/worker');

const modules = [
    'lib/algorunnerCommunication/workerCommunication.js',
    'lib/consumer/JobConsumer.js',
    'lib/states/discovery.js',
    'lib/states/stateManager.js',
    'lib/inputAdapters/inputAdapters.js',
    
];

class Bootstrap {
    async init() {
        try {
            const { main, logger } = await configIt.load();
            this._handleErrors();

            log = new Logger(main.serviceName, logger);
            log.plugins.use(new VerbosityPlugin(main.redis));
            log.info('running application in ' + configIt.env() + ' environment', { component: componentName.MAIN });

            monitor.on('ready', (data) => {
                log.info((data.message).green, { component: componentName.MAIN });
            });
            monitor.on('close', (data) => {
                log.error(data.error.message, { component: componentName.MAIN });
            });
            await monitor.check(main.redis);

            await Promise.all(modules.map(m => require(m).init(main)));
            
            await worker.init(main);

           // tmp
            // const comm = require('./lib/algorunnerCommunication/workerCommunication');
            // comm.once('connection',()=>{
            //     const producerSettings = {
            //         setting: {
            //             queueName: 'queue-workers',
            //             prefix: 'jobs-workers',
            //             redis: {
            //                 host: process.env.REDIS_SERVICE_HOST || 'localhost',
            //                 port: process.env.REDIS_SERVICE_PORT || 6379
            //             }
            //         }
            //     }
            //     const testProducer = {
            //         job: {
            //             type: 'green-alg',
            //             data: {
            //                 jobID:'xxx',
            //                 inputs: {
            //                     standard: [
            //                         'input-1',
            //                         'input-2'
            //                     ],
            //                 }
            //             }
            //         }
            //     }
            //     const { Producer } = require('@hkube/producer-consumer');
            //     const producer = new Producer(producerSettings);
            //     producer.on('job-failed',(jobData)=>{
            //         log.error(`job failed: ${JSON.stringify(jobData)}`)
            //     })
            //     producer.on('job-active',(jobData)=>{
            //         log.info(`job active: ${JSON.stringify(jobData)}`)
            //     })
            //     producer.on('job-waiting',(jobData)=>{
            //         log.info(`job waiting: ${JSON.stringify(jobData)}`)
            //     })
            //     producer.on('job-completed',(jobData)=>{
            //         log.info(`job completed: ${JSON.stringify(jobData)}`)
            //     })
            //     producer.createJob(testProducer)
           
            // })
            return main;
        }
        catch (error) {
            this._onInitFailed(error);
        }
    }

    _onInitFailed(error) {
        if (log) {
            log.error(error.message, { component: componentName.MAIN }, error);
            log.error(error);
        }
        else {
            console.error(error.message);
            console.error(error);
        }
        process.exit(1);
    }

    _handleErrors() {
        process.on('exit', (code) => {
            log.info('exit' + (code ? ' code ' + code : ''), { component: componentName.MAIN });
        });
        process.on('SIGINT', () => {
            log.info('SIGINT', { component: componentName.MAIN });

            process.exit(1);
        });
        process.on('SIGTERM', () => {
            log.info('SIGTERM', { component: componentName.MAIN });
            process.exit(1);
        });
        process.on('unhandledRejection', (error) => {
            log.error('unhandledRejection: ' + error.message, { component: componentName.MAIN }, error);
        });
        process.on('uncaughtException', (error) => {
            log.error('uncaughtException: ' + error.message, { component: componentName.MAIN }, error);
            log.error(JSON.stringify(error))
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();

