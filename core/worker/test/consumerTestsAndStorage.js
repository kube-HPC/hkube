const consumer = require('../lib/consumer/JobConsumer');
const { Producer } = require('@hkube/producer-consumer');
const stateManager = require('../lib/states/stateManager.js');
const { expect } = require('chai');
const workerCommunication = require('../lib/algorithm-communication/workerCommunication');
const worker = require('../lib/worker');
const sinon = require('sinon');
const uuid = require('uuid/v4');
const { workerStates } = require('../lib/consts');
const storageManager = require('@hkube/storage-manager');
const delay = require('delay');
const etcd = require('../lib/states/discovery');
const { Status } = require('../lib/consts');

let spy, producer;

function getConfig() {
    const jobId = 'jobId:' + uuid();
    const taskId = 'taskId:' + uuid();
    return {
        taskId,
        jobId,
        defaultStorage: 's3',
        jobConsumer: {
            job: {
                type: 'test-job',
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
        tracer: {
            tracerConfig: {
                serviceName: 'worker'
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
    afterEach(async function () {
        spy && spy.restore();
        // stateManager.reset();
        // await delay(500);
        // stateManager.bootstrap();
        // await delay(500);
    });
    it('if job already stopped return and finish job', async () => {
        const config = getConfig();
        await etcd._etcd.jobs.status.set({ jobId: config.jobId, status: Status.STOPPED });
        spy = sinon.spy(consumer, '_stopJob');
        consumer._jobProvider.emit('job', {
            data: {
                jobId: config.jobId,
                taskId: config.taskId,
                input: ['test-param', true, 12345],
                pipelineName: Status.STOPPED
            }
        });
        await delay(1000);
        expect(spy.callCount).to.eq(1);
    });
    it('store data and validate result from algorithm', async () => {
        const config = getConfig();
        storageManager.hkube.put({ jobId: config.jobId, taskId: config.taskId, data: { data: { engine: 'deep' } } }).then(async (link) => {
            spy = sinon.spy(consumer, 'finishJob');
            consumer._jobProvider.emit('job', {
                data: {
                    jobId: config.jobId,
                    taskId: config.taskId,
                    input: ['test-param', true, 12345, '$$guid-5'],
                    storage: {
                        'guid-5': { storageInfo: link, path: 'data.engine' }
                    },
                    pipelineName: 'xxx',
                    info: { savePaths: [] }
                }
            });
            await delay(1000);
            const call = spy.getCalls()[0];
            const args = call.args[0];
            expect(args.results.input).to.eql(['test-param', true, 12345, 'deep']);
        });
    });
    xit('received array with null from algorithm', async () => {
        const config = getConfig();
        spy = sinon.spy(consumer, 'finishJob');
        consumer._jobProvider.emit('job', {
            data: {
                jobId: config.jobId,
                taskId: config.taskId,
                input: [null, 1, undefined],
                pipelineName: 'null_array',
                info: { savePaths: [] }
            }
        });
        await delay(1000);
        const call = spy.getCalls()[0];
        const args = call.args[0];
        expect(args.results.input).to.eql([null, 1, undefined]);
    });
    xit('received empty array from algorithm', async () => {
        const config = getConfig();
        spy = sinon.spy(consumer, 'finishJob');
        consumer._jobProvider.emit('job', {
            data: {
                jobId: config.jobId,
                taskId: config.taskId,
                input: [],
                pipelineName: 'empty_array',
                info: { savePaths: [] }
            }
        });
        await delay(1000);
        const call = spy.getCalls()[0];
        const args = call.args[0];
        expect(args.results.input).to.eql([]);
    });
    xit('finish job if failed to store data', async () => {
        const config = getConfig();
        spy = sinon.spy(consumer, 'finishJob');
        consumer._jobProvider.emit('job', {
            data: {
                jobId: config.jobId,
                taskId: config.taskId,
                input: ['$$guid-5'],
                storage: {
                    'guid-5': { storageInfo: { path: 'bucket-not-exists/test123/err' }, path: 'data.engine.inputs.raw' }
                },
                pipelineName: 'xxx',
                info: { savePaths: [] }
            }
        });
        await delay(1000);
        const call = spy.getCalls()[0];
        const args = call.args[0];
        expect(args.results.error.code).to.eql('NoSuchBucket');
    });
    xit('finish job and store data - object with path', () => {
        return (new Promise(async function (resolve, reject) {
            let config = getConfig();
            const arr = [];
            arr.push(storageManager.hkube.put({ jobId: config.jobId, taskId: '1', data: { field: { test: 'test-extract1' } } }))
            arr.push(storageManager.hkube.put({ jobId: config.jobId, taskId: '2', data: { field: { test: 'test-extract2' } } }))
            arr.push(storageManager.hkube.put({ jobId: config.jobId, taskId: '3', data: { field: { test: 'test-extract3' } } }))
            await Promise.all(arr).then((links) => {
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
                                    pipelineName: 'xxx',
                                    storage: {
                                        'guid-5': {
                                            storageInfo: [links[0], links[1], links[2]],
                                            path: 'field.test'
                                        },
                                        info: { savePaths: [] }
                                    },
                                }
                            }
                        });

                        Object.keys(workerStates).forEach(element => {
                            stateManager.once('stateEntered' + element, async (job) => {
                                if (element === 'working') {
                                    workerCommunication.adapter.sendCommandWithDelay({ command: 'done' })
                                }
                                else if (element === 'results') {
                                    expect(job.results.input[0][0]).to.eql("test-extract1");
                                    expect(job.results.input[0][1]).to.eql("test-extract2");
                                    expect(job.results.input[0][2]).to.eql("test-extract3");
                                    resolve();
                                }
                            });
                        });
                    });
                    worker._registerToConnectionEvents();
                    workerCommunication.adapter.start();
                });
            });
        }));
    }).timeout(5000)
});