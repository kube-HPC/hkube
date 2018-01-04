const {expect} = require('chai');
const {generateArr, stubTemplate} = require('./stub/stub');
const delay = require('await-delay');
const querier = require('../lib/querier');
const mockery = require('mockery');
const components = require('../lib/consts/component-name');
const bootstrap = require('../bootstrap');
const queueEvents = require('../lib/consts/queue-events');
const queueRunner = require('../lib/queue-runner');
const heuristic = score => job => (Promise.resolve({...job, ...{calculated: {score, entranceTime: Date.now(), latestScore: {}}}}));
const randomHeuristic = score => job => (Promise.resolve({
    ...job, 
    ...{calculated: {score: Math.floor((Math.random() * 100)), entranceTime: Date.now()}}
}));
const Queue = require('../lib/queue');
const {callDone, done, semaphore} = require('await-done');

let queue = null;
const QUEUE_INTERVAL = 500;

/* eslint-env no-console ignore */ 
const logMock = {
    info: (data, object) => console.log(data, object), //eslint-disable-line
    debug: (data, object) => console.log(data, object),//eslint-disable-line
    warn: (data, object) => console.log(data, object),//eslint-disable-line
    
};

describe('algorithm queue', () => {
    before(async () => {
        mockery.registerMock('log', logMock);
        await bootstrap.init();
    });  
    
    describe('queue-tests', () => {
        describe('add', () => {
            beforeEach(() => {
                queue = new Queue({updateInterval: QUEUE_INTERVAL});
            });
            it('should added to queue', async () => {
                queue.updateHeuristic(heuristic(80));
                await queue.add([stubTemplate()]);
                await delay(QUEUE_INTERVAL + 500);
                const q = queue.get;
                expect(q[0].calculated.score).to.eql(80);
            });
            it('should added to queue ordered', async () => {
                queue.updateHeuristic(heuristic(80));
                await queue.add([stubTemplate()]);
                queue.updateHeuristic(heuristic(60));
                await queue.add([stubTemplate()]);
                queue.updateHeuristic(heuristic(90));
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
                queue = new Queue({updateInterval: QUEUE_INTERVAL});
                _semaphore = new semaphore();
            });
            it('should removed from queue', async () => {
                queue.updateHeuristic(heuristic(80));
                const stubJob = stubTemplate();
                await queue.add([stubJob]);
                queue.on(queueEvents.REMOVE, () => {
                    _semaphore.callDone(); 
                });
                queue.remove([stubJob.jobId]);
                //  await delay(QUEUE_INTERVAL + 500);
                await _semaphore.done();
                const q = queue.get;
                expect(q).to.have.length(0);
            });
            it('should not removed from queue when there is no matched id', async () => {
                queue.updateHeuristic(heuristic(80));
                const stubJob = stubTemplate();
                await queue.add([stubJob]);
                queue.on(queueEvents.REMOVE, () => {
                    _semaphore.callDone(); 
                });
                queue.remove(['111222333']);
                //  await delay(QUEUE_INTERVAL + 500);
                await _semaphore.done();
                const q = queue.get;
                expect(q).to.have.length(1);
                expect(q[0].jobId).to.be.eql(stubJob.jobId);
            });
        });


        describe('pop', () => {
            let _semaphore = null;
            beforeEach(() => {
                queue = new Queue({updateInterval: QUEUE_INTERVAL});
                _semaphore = new semaphore();
            });
            it('should pop from queue', async () => {
                queue.updateHeuristic(heuristic(80));
                const stubJob = stubTemplate();
                await queue.add([stubJob]);
                queue.on(queueEvents.POP, () => {
                    _semaphore.callDone(); 
                });
                queue.on(queueEvents.REMOVE, () => {
                    _semaphore.callDone(); 
                });
                const job = queue.pop();
                //  await delay(QUEUE_INTERVAL + 500);
                await _semaphore.done({doneAmount: 2});
                const q = queue.get;
                expect(job.jobId).to.be.eql(stubJob.jobId);
                expect(q).to.have.length(0);
            });
        });
        describe('queue-events', () => {
            let _semaphore = null;
            beforeEach(() => {
                queue = new Queue({updateInterval: QUEUE_INTERVAL});
                _semaphore = new semaphore();
            });
            it('check events insert', async () => {
                queue.on(queueEvents.INSERT, () => _semaphore.callDone());
                queue.updateHeuristic(heuristic(80));
                queue.intervalRunningStatus = false;
                await queue.add([stubTemplate()]);
                await _semaphore.done();
                console.log('done '); //eslint-disable-line
            });
            it('check events remove', async () => {
                queue.on(queueEvents.REMOVE, () => _semaphore.callDone());
                queue.updateHeuristic(heuristic(80));
                queue.intervalRunningStatus = false;
                const stubJob = stubTemplate();
                await queue.add([stubJob]);
                await queue.remove([stubJob.jobId]);
                await _semaphore.done();
                console.log('done '); //eslint-disable-line
            });
            afterEach(() => {
                queue.intervalRunningStatus = false;
            });
        });
    });
    
    describe('queue-runner', () => {
        it('check-that-heuristics-sets-to-latestScore', async () => {
            //  queue.updateHeuristic(heuristic(80));
            const stubJob = stubTemplate();
            await queueRunner.queue.add([stubJob]);
            await delay(500);
            const q = queueRunner.queue.get;
            console.log(q);
        });
    });
});
