const bootstrap = require('../bootstrap');
const Consumer = require('../lib/consumer/JobConsumer');
const { Producer } = require('@hkube/producer-consumer');
const stateManager = require('../lib/states/stateManager.js');
const {expect} = require('chai');
const workerCommunication = require('../lib/algorunnerCommunication/workerCommunication');
const messages = require('../lib/algorunnerCommunication/messages');
const worker = require('../lib/worker');
const jobID = 'test-jobID-3232dd-124fdg4-sdffs234-cs3424';

const jobConsumerConfig = {
    jobConsumer: {
        job: {
            type: 'test-job',
            data: {
                jobID
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
};

const testProducer = {
    job: {
        type: 'test-job',
        data: {
            jobID,
            inputs: {
                standard: [
                    'input-1',
                    'input-2'
                ],
            }
        }
    }
};
const producerSettings = {
    setting: {
        queueName: 'queue-workers',
        prefix: 'jobs-workers',
        redis: {
            host: process.env.REDIS_SERVICE_HOST || 'localhost',
            port: process.env.REDIS_SERVICE_PORT || 6379
        }
    }
};
let consumer;
let producer;
describe('consumer', () => {
    beforeEach((done) => {
        bootstrap.init().then(() => {
            consumer = Consumer;
        }).then(() => {
            return consumer.init(jobConsumerConfig);
        }).then(() => {
            stateManager.on('stateEnteredready', () => {
                done();
            });
            worker._registerToConnectionEvents();
            workerCommunication.adapter.start();
        });
    });
    it('should get job', (done) => {
        producer = new Producer(producerSettings);
        consumer.once('job', (() => {
            expect(stateManager.state).to.eql('init');
            done();
        }));
        producer.createJob(testProducer);
    }).timeout(5000);

    it('should send init to worker', (done) => {
        workerCommunication.once(messages.incomming.initialized, (message) => {
            expect(message.id).to.not.be.undefined;
            done();
        });
        producer = new Producer(producerSettings);
        producer.createJob(testProducer);
    }).timeout(5000);
});
