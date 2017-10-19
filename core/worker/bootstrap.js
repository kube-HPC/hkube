
process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();

const configIt = require('config.rf');
const Logger = require('logger.rf');
const VerbosityPlugin = require('logger.rf').VerbosityPlugin;
const monitor = require('redis-utils.rf').Monitor;
const componentName = require('common/consts/componentNames');
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
            const comm = require('./lib/algorunnerCommunication/workerCommunication');
            comm.once('connection',()=>{
                // comm.send({command:'initialize',data:{job:'xxx'}})
                const producerSettings = {
                    setting: {
                        queueName: 'queue-workers',
                        prefix: 'jobs-workers',
                        redis: {
                            host: process.env.REDIS_SERVICE_HOST || 'localhost',
                            port: process.env.REDIS_SERVICE_PORT || 6379
                        }
                    }
                }
                const testProducer = {
                    job: {
                        type: 'green-bla',
                        data: {
                            inputs: {
                                standard: [
                                    'input-1',
                                    'input-2'
                                ],
                            }
                        }
                    }
                }
                const { Producer } = require('producer-consumer.rf');
                const producer = new Producer(producerSettings);
                producer.on('job-failed',(jobData)=>{
                    log.error(`job failed: ${jobData}`)
                })
                producer.on('job-active',(jobData)=>{
                    log.error(`job active: ${jobData}`)
                })
                producer.on('job-waiting',(jobData)=>{
                    log.error(`job waiting: ${jobData}`)
                })
                producer.on('job-completed',(jobData)=>{
                    log.error(`job completed: ${jobData}`)
                })
                producer.createJob(testProducer)

            })
            return main;
        }
        catch (error) {
            this._onInitFailed(new Error(`unable to start application. ${error.message}`));
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
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();

