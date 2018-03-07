const bootstrap = require('../bootstrap');
const Consumer = require('../lib/consumer/JobConsumer');
const { Producer } = require('@hkube/producer-consumer');
const stateManager = require('../lib/states/stateManager.js');
const { expect } = require('chai');
const workerCommunication = require('../lib/algorunnerCommunication/workerCommunication');
const messages = require('../lib/algorunnerCommunication/messages');
const worker = require('../lib/worker');
const s3adapter = require('@hkube/s3-adapter');

const uuid = require('uuid/v4');
const jobID = 'jobId:' + uuid();
const taskID = 'taskId:' + uuid();

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
    },
    datastoreAdapter: {
        connection: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            endpoint: process.env.AWS_ENDPOINT || 'http://127.0.0.1:9000'
        },
        moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
    },
    k8s: {
        pod_name: process.env.POD_NAME || 'tal'
    }
};

const testProducer = {
    job: {
        type: 'test-job',
        data: {
            jobID,
            taskID,
            input: [
                5,
                true,
                'input-1',
                ['$$guid-3'],
                {
                    data: {
                        standard: [
                            'input-1',
                            'input-2',
                            '$$guid-3',
                            'input-4',
                            '$$guid-3',
                            '$$guid-3'
                        ]
                    }
                },
                {
                    moreData: ['$$guid-3']
                }
            ],
            storage: {
                'guid-3': { accessor: { Bucket: jobID, Key: taskID }, path: 'data.engine.inputs.raw' }
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
            // init s3
            s3adapter.jobPath({ jobId: jobID }).then(() => {
                s3adapter.put({
                    jobId: jobID,
                    taskId: taskID,
                    data: {
                        data: { engine: { inputs: { raw: ['input-31', 'input-32'] } } }
                    }
                });
                done();
            });
        });
    });
    it('should send init to worker and validate data from s3', (done) => {
        consumer.init(jobConsumerConfig).then(() => {
            stateManager.once('stateEnteredready', () => {
                workerCommunication.once(messages.incomming.initialized, (message) => {
                    const inputWithData = [
                        5,
                        true,
                        'input-1',
                        [['input-31', 'input-32']],
                        {
                            data: {
                                standard: [
                                    'input-1',
                                    'input-2',
                                    ['input-31', 'input-32'],
                                    'input-4',
                                    ['input-31', 'input-32'],
                                    ['input-31', 'input-32']
                                ]
                            }
                        },
                        {
                            moreData: [['input-31', 'input-32']]
                        }
                    ];
                    expect(message.input).to.deep.equal(inputWithData);
                    expect(message.jobID).to.not.be.undefined;
                    done();
                });
                producer = new Producer(producerSettings);
                producer.createJob(testProducer);
            });
            worker._registerToConnectionEvents();
            workerCommunication.adapter.start();
        });
    }).timeout(5000);

});
