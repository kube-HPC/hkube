const bootstrap = require('../bootstrap');
const Consumer = require('../lib/consumer/JobConsumer');
const { Producer } = require('@hkube/producer-consumer');
const stateManager = require('../lib/states/stateManager.js');
const { expect } = require('chai');
const workerCommunication = require('../lib/algorunnerCommunication/workerCommunication');
const worker = require('../lib/worker');
const s3adapter = require('@hkube/s3-adapter');

const uuid = require('uuid/v4');
const jobID = 'jobId:' + uuid();
const taskID = 'taskId:' + uuid();

const jobConsumerConfig2 = {
    defaultStorage: 's3',
    jobConsumer: {
        job: {
            type: 'test-job2',
            data: {
                jobID
            }
        },
        setting: {
            queueName: 'queue-workers2',
            prefix: 'jobs-workers2',
        }
    },
    redis: {
        host: process.env.REDIS_SERVICE_HOST || 'localhost',
        port: process.env.REDIS_SERVICE_PORT || 6379
    },
    storageAdapters: {
        s3: {
            connection: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
                endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000'
            },
            moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
        }
    },
    kubernetes: {
        pod_name: process.env.POD_NAME || 'tal'
    }
};

const producerSettings2 = {
    setting: {
        queueName: 'queue-workers2',
        prefix: 'jobs-workers2',
        redis: {
            host: process.env.REDIS_SERVICE_HOST || 'localhost',
            port: process.env.REDIS_SERVICE_PORT || 6379
        }
    }
};

let consumer;
let producer;
describe('consumer fail tests', () => {
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

    it('should fail if bucket not exists', (done) => {
        consumer.init(jobConsumerConfig2).then(() => {
            stateManager.once('stateEnteredready', () => {
                producer = new Producer(producerSettings2);
                producer.createJob({
                    job: {
                        type: 'test-job2',
                        data: {
                            jobID,
                            taskID,
                            input: ['$$guid-5'],
                            storage: {
                                'guid-5': { storageInfo: { Bucket: 'bucketNotExists', Key: taskID }, path: 'data.engine.inputs.raw' }
                            }
                        },
                    }
                });
                stateManager.once('stateEnteredready', (job) => {
                    expect(job.results.error.message).to.eql('The specified bucket does not exist');
                    expect(job.results.error.code).to.eql('NoSuchBucket');
                    expect(stateManager.state).to.eql('ready');
                    done();
                });
            });
            worker._registerToConnectionEvents();
            workerCommunication.adapter.start();
        });
    }).timeout(5000);
});
