const configIt = require('config.rf');
const Logger = require('logger.rf');
const VerbosityPlugin = require('logger.rf').VerbosityPlugin;
const bootstrap = require('../bootstrap')
const Consumer = require('../lib/consumer/JobConsumer');
const discovery = require('../lib/states/discovery');
const { Producer } = require('producer-consumer.rf');
const stateManager = require('../lib/states/stateManager.js')
const expect = require('chai').expect
const workerCommunication = require('../lib/algorunnerCommunication/workerCommunication')
const messages = require('../lib/algorunnerCommunication/messages');

const jobConsumerConfig = {
    jobConsumer: {
        job: {
            type: 'test-job'
        },
        setting: {
            queueName: 'queue-workers',
            prefix: 'jobs-workers',


        }

    },
    redis: {
        host: process.env.REDIS_SERVICE_HOST || 'localhost',
        port: process.env.REDIS_SERVICE_PORT || 6379
    }
}

const testProducer = {
    job: {
        type: 'test-job',
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
const workerCommunicationConfig = {
    workerCommunication:
    {
        adapterName: 'loopback',
        config: {}
    }
}
let log;
let consumer;
let producer;
describe('consumer', () => {
    before(async () => {
        // const {main, logger} = await configIt.load();
        // log = new Logger(main.serviceName, logger);
        // log.plugins.use(new VerbosityPlugin(main.redis));
        // await discovery.init(main)


        process.on('unhandledRejection', (error) => {
            console.error('unhandledRejection: ' + error.message);
        });
        process.on('uncaughtException', (error) => {
            console.error('uncaughtException: ' + error.message);
        });

    })

    beforeEach(async () => {
        await bootstrap.init();
        consumer = Consumer;
        await consumer.init(jobConsumerConfig);
        await workerCommunication.init(workerCommunicationConfig);

    });
    it('should get job', (done) => {

        producer = new Producer(producerSettings);
        consumer.once('job', (job => {
            expect(stateManager.state).to.eql('init');
            done();
        }))
        producer.createJob(testProducer)
    }).timeout(5000)

    it('should send init to worker', (done) => {
        workerCommunication.once(messages.incomming.initialized, (data) => {
            done();
        })
        producer = new Producer(producerSettings);

        producer.createJob(testProducer)

    }).timeout(5000)





})