const { expect } = require('chai');
const { uid: uuidv4 } = require('@hkube/uid');
const concurrencyMap = require('../lib/jobs/concurrency-map');
const dataStore = require('../lib/persistency/data-store');

let consumer;
let queueRunner;
let producerLib;
let config;

describe('concurrency', () => {
    before(async () => {
        consumer = require('../lib/jobs/consumer');
        queueRunner = require('../lib/queue-runner');
        producerLib = require('../lib/jobs/producer');
        await dataStore._db.jobs.deleteMany({ 'pipeline.name': 'pipeline-concurrency' }, { allowNotFound: true });
        config = global.testParams.config;
    });
    it('should disable concurrency limit', () => {
        const name = 'test-max';
        const pipeline1 = {
            name,
            concurrency: {
                max: 5,
                limit: true,
            }
        }
        const pipeline2 = {
            name,
            concurrency: {
                max: 5,
                limit: true,
            }
        }
        const pipeline3 = {
            name,
            concurrency: {
                max: 5,
                limit: true,
            }
        }
        concurrencyMap.mapActiveJobs([{ name }, { name }]);
        concurrencyMap.checkConcurrencyLimit(pipeline1);
        concurrencyMap.checkConcurrencyLimit(pipeline2);
        concurrencyMap.checkConcurrencyLimit(pipeline3);

        expect(pipeline1.concurrency.limit).to.eql(false);
        expect(pipeline2.concurrency.limit).to.eql(false);
        expect(pipeline3.concurrency.limit).to.eql(false);
    });
    it('should disable concurrency limit after start', async () => {
        const max = 10;
        for (let i = 0; i < max; i++) {
            const jobId = uuidv4();
            const job = {
                jobId,
                pipeline: {
                    name: `pipeline-concurrency`,
                    experimentName: `experiment-concurrency`,
                    priority: 5,
                    concurrency: {
                        limit: true,
                        max
                    },
                    types: ['stored'],
                    options: {
                        concurrentPipelines: {
                            amount: max,
                            rejectOnFailure: false
                        }
                    }
                },
                status: {
                    status: i % 2 === 0 ? 'queued' : 'active'
                }
            };
            await dataStore._db.jobs.create(job);
            queueRunner.queue.enqueue(job);
        }
        expect(queueRunner.queue.size).to.eql(10);
        await producerLib.init(config);
        expect(queueRunner.queue.size).to.eql(5);
    });
});