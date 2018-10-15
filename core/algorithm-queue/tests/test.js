/* eslint-disable */
const decache = require('decache');
const { expect } = require('chai');
const { generateArr, stubTemplate, generateConsumedArray } = require('./stub/stub');
const delay = require('await-delay');
const querier = require('../lib/querier');
const mockery = require('mockery-partial');
const components = require('../lib/consts/component-name');
const queueEvents = require('../lib/consts/queue-events');
const { callDone, done, semaphore } = require('await-done');
const { mockConsumer } = require('./mock/index');
let bootstrap = require('../bootstrap'); //eslint-disable-line
const queueRunner = require('../lib/queue-runner');
const EnrichmentRunner = require('../lib/enrichment-runner');

let Queue = null;

const heuristic = score => job => (Promise.resolve({ ...job, ...{ calculated: { score, entranceTime: Date.now(), latestScore: {} } } }));
const heuristicBoilerPlate = (score, _heuristic) => ({
    run(job) {
        return _heuristic(score)(job);
    }
});
const randomHeuristic = score => job => (Promise.resolve({
    ...job,
    ...{ calculated: { score: Math.floor((Math.random() * 100)), entranceTime: Date.now() } }
}));

const clearCache = arr => arr.forEach(r => {
    try {
        //   decache(r);
    }
    catch (error) {
        console.error(`decache ${r} error:${error}`);//eslint-disable-line
    }
});

let queue = null;
const QUEUE_INTERVAL = 500;

/* eslint-env no-console ignore */
const logMock = {
    info: (data, object) => console.log(data, object), //eslint-disable-line
    debug: (data, object) => console.log(data, object),//eslint-disable-line
    warn: (data, object) => console.log(data, object),//eslint-disable-line

};

describe('Test', () => {
    before(async () => {
        await bootstrap.init();
    });
    describe('algorithm queue', () => {

        describe('queue-tests', () => {
            describe('add', () => {
                beforeEach(() => {
                    Queue = require('../lib/queue'); //eslint-disable-line
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL, enrichmentRunner: new EnrichmentRunner() });
                });
                it('should added to queue', async () => {
                    queue.updateHeuristic(heuristicBoilerPlate(80, heuristic));
                    await queue.add([stubTemplate()]);
                    await delay(QUEUE_INTERVAL + 500);
                    const q = queue.get;
                    expect(q[0].calculated.score).to.eql(80);
                }).timeout(5000);
                it('should added to queue ordered', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    await queue.add([stubTemplate()]);
                    queue.updateHeuristic({ run: heuristic(60) });
                    await queue.add([stubTemplate()]);
                    queue.updateHeuristic({ run: heuristic(90) });
                    await queue.add([stubTemplate()]);
                    //  console.log('queue status', querier(queue.get).getScoreJobIdArray());
                    expect(queue.get[0].calculated.score).to.eql(90);
                    expect(queue.get[2].calculated.score).to.eql(60);
                    queue.intervalRunningStatus = false;
                }).timeout(5000);
            });
            describe('remove', () => {
                let _semaphore = null;
                beforeEach(() => {
                    Queue = require('../lib/queue'); //eslint-disable-line
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL, enrichmentRunner: new EnrichmentRunner() });
                    _semaphore = new semaphore();
                });
                it('should removed from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    queue.on(queueEvents.REMOVE, () => {
                        _semaphore.callDone();
                    });
                    queue.removeJobId([stubJob.jobId]);
                    await _semaphore.done();
                    const q = queue.get;
                    expect(q).to.have.length(0);
                }).timeout(50000);
                it('should not removed from queue when there is no matched id', async () => {
                    let called = false;
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    queue.on(queueEvents.REMOVE, () => {
                        called = true;
                    });
                    queue.removeJobId(['111222333']);
                    expect(called).to.equal(false);
                    const q = queue.get;
                    expect(q).to.have.length(1);
                    expect(q[0].jobId).to.be.eql(stubJob.jobId);
                });
            });


            describe('pop', () => {
                let _semaphore = null;
                beforeEach(() => {
                    Queue = require('../lib/queue'); //eslint-disable-line
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL, enrichmentRunner: new EnrichmentRunner() });
                    _semaphore = new semaphore();
                });
                it('should pop from queue', async () => {
                    queue.updateHeuristic({ run: heuristic(80) });
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    queue.on(queueEvents.POP, () => {
                        _semaphore.callDone();
                    });
                    const job = queue.tryPop();
                    await _semaphore.done({ doneAmount: 1 });
                    const q = queue.get;
                    expect(job.jobId).to.be.eql(stubJob.jobId);
                    expect(q).to.have.length(0);
                });
            });
            describe('queue-runner', () => {
                //    let queueRunner = null;

                it('check-that-heuristics-sets-to-latestScore', async () => {
                    //  queue.updateHeuristic(heuristic(80));
                    const stubJob = stubTemplate();
                    await queueRunner.queue.add([stubJob]);
                    await delay(500);
                    const q = queueRunner.queue.get;
                    console.log(q)
                    expect(q[0].calculated.latestScores).to.have.property('BATCH');
                    expect(q[0].calculated.latestScores).to.have.property('PRIORITY');
                    expect(q[0].calculated.latestScores).to.have.property('ENTRANCE_TIME');
                    expect(q[0].calculated.score).to.be.above(0);
                    // await delay(5000);
                    // console.log(q);
                });
                after(() => {
                    //  clearCache(['../bootstrap', '../lib/queue-runner']);
                });
            });

            describe('queue-events', () => {
                let _semaphore = null;
                beforeEach(() => {
                    Queue = require('../lib/queue'); //eslint-disable-line
                    queue = new Queue({ updateInterval: QUEUE_INTERVAL, enrichmentRunner: new EnrichmentRunner() });
                    _semaphore = new semaphore();
                });
                it('check events insert', async () => {
                    queue.on(queueEvents.INSERT, () => _semaphore.callDone());
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.intervalRunningStatus = false;
                    await queue.add([stubTemplate()]);
                    await _semaphore.done();
                    console.log('done '); //eslint-disable-line
                });
                it('check events remove', async () => {
                    queue.on(queueEvents.REMOVE, () => _semaphore.callDone());
                    queue.updateHeuristic({ run: heuristic(80) });
                    queue.intervalRunningStatus = false;
                    const stubJob = stubTemplate();
                    await queue.add([stubJob]);
                    await queue.removeJobId([stubJob.jobId]);
                    await _semaphore.done();
                    console.log('done '); //eslint-disable-line
                });
                afterEach(() => {
                    queue.intervalRunningStatus = false;
                });
                after(() => {
                    queue.flush();
                    try {
                        clearCache(['../lib/queue']);
                    }
                    catch (e) {

                    }
                });
            });
        });


        after(() => {
            //    clearCache(['../lib/queue', '../bootstrap', '../lib/queue-runner']);
            console.log('--------cleared---------');
        });
    });

    describe('persistency tests', () => {
        //   let queueRunner = null;
        //     let bootstrap = null;
        // before(async () => {
        //     console.log('------------------------------------');
        //     console.log('persistency tests');
        //     console.log('------------------------------------');
        //     //   clearCache(['../lib/queue', '../bootstrap', '../lib/queue-runner']);
        //     console.log('queue runner b');
        //     try {
        //    //     bootstrap = require('../bootstrap'); //eslint-disable-line
        //    //     queueRunner = require('../lib/queue-runner'); //eslint-disable-line
        //         await bootstrap.init();
        //     }
        //     catch (e) {
        //         console.error('queue runner a');
        //     }   
        //     console.log('queue runner a');
        //      //eslint-disable-line
        // });
        it('persistent load', async () => {
            queueRunner.queue.flush()
            await queueRunner.queue.add(generateArr(100));
            await queueRunner.queue.persistenceStore();
            queueRunner.queue.flush();
            await queueRunner.queue.persistencyLoad();
            await delay(500);
            const q = queueRunner.queue.get;
            expect(q.length).to.be.greaterThan(98);
            queueRunner.queue.flush();
            await queueRunner.queue.persistenceStore();
            await delay(500);
        });
        after(() => {
            // clearCache(['../bootstrap', '../lib/queue-runner']);
        });
    });
    describe('test jobs order', () => {
        it('order 100', async () => {
            queueRunner.queue.flush()
            await queueRunner.queue.add(generateArr(100));
            await delay(500);
            const q = queueRunner.queue.get;
            expect(q.length).to.be.greaterThan(98);

            await delay(500);
        });
    })

    describe('job-consume', () => {
        let _mockConsumer = null;
        before(async () => {
            try {
                mockery.enable({
                    warnOnReplace: false,
                    warnOnUnregistered: false,
                    useCleanCache: true
                });
                //           bootstrap = require('../bootstrap'); //eslint-disable-line
                //         queueRunner = require('../lib/queue-runner'); //eslint-disable-line
                //eslint-disable-line
                _mockConsumer = mockConsumer.register();
                await bootstrap.init();
            }
            catch (error) {
                console.error('could not locate binding file'); //eslint-disable-line
            }
            //   clearCache(['../lib/queue', '../bootstrap', '../lib/queue-runner']);
        });
        // xit('should consume jobs and send to queue', async () => {
        //     console.log('bla');
        //    _mockConsumer.Consumer()._emit(generateConsumedArray(100))
        //     await delay(100)
        //     let q = queueRunner.queue.get;
        //     expect(q.length).to.be.equal(100);
        // });
        // after(() => {
        //     clearCache(['../bootstrap', '../lib/queue-runner']);
        // });
    });
    afterEach(() => {
        queueRunner.queue.flush();
    });

});

