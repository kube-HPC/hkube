const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const VerbosityPlugin = require('@hkube/logger').VerbosityPlugin;
const bootstrap = require('../bootstrap')
const Consumer = require('../lib/consumer/JobConsumer');
const discovery = require('../lib/states/discovery');
const { Producer } = require('@hkube/producer-consumer');
const stateManager = require('../lib/states/stateManager.js')
const expect = require('chai').expect
const workerCommunication = require('../lib/algorunnerCommunication/workerCommunication')
const messages = require('../lib/algorunnerCommunication/messages');

const jobID = 'test-jobID-3232dd-124fdg4-sdffs234-cs3424';

const jobConsumerConfig = {
    jobConsumer: {
        job: {
            type: 'test-job',
            data: {
                jobID: jobID
            }
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
            jobID: jobID,
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


        // process.on('unhandledRejection', (error) => {
        //     console.error('unhandledRejection: ' + error.message);
        // });
        // process.on('uncaughtException', (error) => {
        //     console.error('uncaughtException: ' + error.message);
        // });

    })

    beforeEach((done) => {
        
        bootstrap.init().then(() => {
            consumer = Consumer;

        }).then(() => {

            return consumer.init(jobConsumerConfig);
            // }).then(()=>{
            //    return workerCommunication.init(workerCommunicationConfig);
        }).then(() => {
            stateManager.on('stateEnteredready', () => {
                done()
            })
            workerCommunication.adapter.start();
        });

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
        workerCommunication.once(messages.incomming.initialized, (message) => {
            expect(message.data.jobID).to.not.be.undefined;
            done();
        })
        producer = new Producer(producerSettings);

        producer.createJob(testProducer)

    }).timeout(5000)





})