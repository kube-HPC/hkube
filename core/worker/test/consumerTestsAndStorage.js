const bootstrap = require('../bootstrap');
const Consumer = require('../lib/consumer/JobConsumer');
const { Producer } = require('@hkube/producer-consumer');
const stateManager = require('../lib/states/stateManager.js');
const { expect } = require('chai');
const workerCommunication = require('../lib/algorithm-communication/workerCommunication');
const worker = require('../lib/worker');
const uuid = require('uuid/v4');
const { workerStates } = require('../lib/consts');
const storageManager = require('@hkube/storage-manager');

let consumer, producer;

function getConfig() {
    const jobId = 'jobId:' + uuid();
    const taskId = 'taskId:' + uuid();
    return {
        taskId,
        jobId,
        defaultStorage: 's3',
        jobConsumer: {
            job: {
                type: 'test-job' + uuid(),
                data: {
                    jobId
                }
            },
            setting: {
                queueName: 'queue-workers-' + uuid(),
                prefix: 'jobs-workers-' + uuid(),
                redis: {
                    host: process.env.REDIS_SERVICE_HOST || 'localhost',
                    port: process.env.REDIS_SERVICE_PORT || 6379
                }
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
}

describe('consumer tests', () => {
    beforeEach(async () => {
        let config = getConfig();
        await storageManager.init(config, true);
        await bootstrap.init();
        consumer = Consumer;
    });
    it('store data and validate result from algorithm', (done) => {
        let config = getConfig();
        storageManager.put({ jobId: config.jobId, taskId: config.taskId, data: { data: { engine: 'deep' } } }).then((link) => {
            consumer.init(config).then(() => {
                stateManager.once('stateEnteredready', async () => {
                    producer = new Producer(config.jobConsumer);
                    let x = await producer.createJob({
                        job: {
                            type: config.jobConsumer.job.type,
                            data: {
                                jobId: config.jobId,
                                taskId: config.taskId,
                                input: ['test-param', true, 12345, '$$guid-5'],
                                storage: {
                                    'guid-5': { storageInfo: link, path: 'data.engine' }
                                },
                                pipelineName: 'xxx'
                            },
                        }
                    });
                    Object.keys(workerStates).forEach(element => {
                        stateManager.once('stateEntered' + element, (job) => {
                            if (element === 'working') {
                                workerCommunication.adapter.sendCommandWithDelay({ command: 'done' })
                            }
                            else if (element === 'results') {
                                expect(job.results.input).to.eql(['test-param', true, 12345, 'deep']);
                                done();
                            }
                        });
                    });
                });
                worker._registerToConnectionEvents();
                workerCommunication.adapter.start();
            })
        });
    }).timeout(5000);
    it('received array with null from algorithm', (done) => {
        let config = getConfig();
        consumer.init(config).then(() => {
            stateManager.once('stateEnteredready', async () => {
                producer = new Producer(config.jobConsumer);
                await producer.createJob({
                    job: {
                        type: config.jobConsumer.job.type,
                        data: {
                            jobId: config.jobId,
                            taskId: config.taskId,
                            input: [null, 1, undefined],
                            pipelineName: 'xxx'
                        }
                    }
                });
                Object.keys(workerStates).forEach(element => {
                    stateManager.once('stateEntered' + element, (job) => {
                        if (element === 'working') {
                            workerCommunication.adapter.sendCommandWithDelay({ command: 'done' })
                        }
                        else if (element === 'results') {
                            expect(job.results.input[0]).to.eql(null);
                            expect(job.results.input[1]).to.eql(1);
                            expect(job.results.input[2]).to.eql(null);
                            done();
                        }
                    });
                });
            });
            worker._registerToConnectionEvents();
            workerCommunication.adapter.start();
        });
    });
    it('received empty array from algorithm', (done) => {
        let config = getConfig();
        consumer.init(config).then(() => {
            stateManager.once('stateEnteredready', async () => {
                producer = new Producer(config.jobConsumer);
                await producer.createJob({
                    job: {
                        type: config.jobConsumer.job.type,
                        data: {
                            jobId: config.jobId,
                            taskId: config.taskId,
                            input: [],
                            pipelineName: 'xxx'
                        },

                    }
                });
                Object.keys(workerStates).forEach(element => {
                    stateManager.once('stateEntered' + element, (job) => {
                        if (element === 'working') {
                            workerCommunication.adapter.sendCommandWithDelay({ command: 'done' })
                        }
                        else if (element === 'results') {
                            expect(job.results.input).to.eql([]);
                            done();
                        }
                    });
                });
            });
            worker._registerToConnectionEvents();
            workerCommunication.adapter.start();
        });
    }).timeout(10000);
    xit('finish job if failed to store data', (done) => {
        let config = getConfig();
        consumer.init(config).then(() => {
            stateManager.once('stateEnteredready', async () => {
                producer = new Producer(config.jobConsumer);
                await producer.createJob({
                    job: {
                        type: config.jobConsumer.job.type,
                        data: {
                            jobId: config.jobId,
                            taskId: config.taskId,
                            input: ['$$guid-5'],
                            storage: {
                                'guid-5': { storageInfo: { Bucket: 'bucket-not-exists', Key: config.taskId }, path: 'data.engine.inputs.raw' }
                            },
                            pipelineName: 'xxx'
                        },
                    }
                });
                Object.keys(workerStates).forEach(element => {
                    stateManager.once('stateEntered' + element, (job) => {
                        if (element === 'results') {
                            expect(job.results.error.code).to.eql('NoSuchBucket');
                            done();
                        }
                    });
                });
            });
            worker._registerToConnectionEvents();
            workerCommunication.adapter.start();
        });
    });
    it('get input from storage and send to algorithm', (done) => {
        let config = getConfig();
        storageManager.put({ jobId: config.jobId, taskId: config.taskId, data: 'test' }).then((link) => {
            consumer.init(config).then(() => {
                stateManager.once('stateEnteredready', async () => {
                    producer = new Producer(config.jobConsumer);
                    await producer.createJob({
                        job: {
                            type: config.jobConsumer.job.type,
                            data: {
                                jobId: config.jobId,
                                taskId: config.taskId,
                                input: ['$$guid-5'],
                                storage: {
                                    'guid-5': { storageInfo: link }
                                },
                                pipelineName: 'xxx'
                            },
                        }
                    });
                    Object.keys(workerStates).forEach(element => {
                        stateManager.once('stateEntered' + element, (job) => {
                            if (element === 'working') {
                                workerCommunication.adapter.sendCommandWithDelay({ command: 'done' })
                            }
                            else if (element === 'results') {
                                expect(job.results.input).to.eql(["test"]);
                                done();
                            }
                        });
                    });
                });
                worker._registerToConnectionEvents();
                workerCommunication.adapter.start();
            });
        });
    }).timeout(5000);
});
