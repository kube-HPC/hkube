const decache = require('decache');
const {expect} = require('chai');
const {generateArr, stubTemplate} = require('./stub/stub');
const delay = require('await-delay');
const querier = require('../lib/querier');
const mockery = require('mockery');
const components = require('../lib/consts/component-name');
const queueEvents = require('../lib/consts/queue-events');
const {callDone, done, semaphore} = require('await-done');
let bootstrap = null;
let Queue = null;

const heuristic = score => job => (Promise.resolve({...job, ...{calculated: {score, entranceTime: Date.now(), latestScore: {}}}}));
const heuristicBoilerPlate = (score, _heuristic) => ({
    run(job) {
        return _heuristic(score)(job); 
    }
});
const randomHeuristic = score => job => (Promise.resolve({
    ...job, 
    ...{calculated: {score: Math.floor((Math.random() * 100)), entranceTime: Date.now()}}
}));

const clearCache = arr => arr.forEach(r => decache(r));

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
        bootstrap = require('../bootstrap'); //eslint-disable-line
        Queue = require('../lib/queue'); //eslint-disable-line
        mockery.registerMock('log', logMock);
        await bootstrap.init();
        console.log('------------------------------------');
        console.log('algorithm queue');
        console.log('------------------------------------');
    });  
    
    describe('queue-tests', () => {
        describe('add', () => {
            beforeEach(() => {
                Queue = require('../lib/queue'); //eslint-disable-line
                queue = new Queue({updateInterval: QUEUE_INTERVAL});
            });
            it('should added to queue', async () => {
                queue.updateHeuristic(heuristicBoilerPlate(80, heuristic));
                await queue.add([stubTemplate()]);
                await delay(QUEUE_INTERVAL + 500);
                const q = queue.get;
                expect(q[0].calculated.score).to.eql(80);
            });
            it('should added to queue ordered', async () => {
                queue.updateHeuristic({run: heuristic(80)});
                await queue.add([stubTemplate()]);
                queue.updateHeuristic({run: heuristic(60)});
                await queue.add([stubTemplate()]);
                queue.updateHeuristic({run: heuristic(90)});
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
                queue = new Queue({updateInterval: QUEUE_INTERVAL});
                _semaphore = new semaphore();
            });
            it('should removed from queue', async () => {
                queue.updateHeuristic({run: heuristic(80)});
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
                queue.updateHeuristic({run: heuristic(80)});
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
                Queue = require('../lib/queue'); //eslint-disable-line
                queue = new Queue({updateInterval: QUEUE_INTERVAL});
                _semaphore = new semaphore();
            });
            it('should pop from queue', async () => {
                queue.updateHeuristic({run: heuristic(80)});
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
                Queue = require('../lib/queue'); //eslint-disable-line
                queue = new Queue({updateInterval: QUEUE_INTERVAL});
                _semaphore = new semaphore();
            });
            it('check events insert', async () => {
                queue.on(queueEvents.INSERT, () => _semaphore.callDone());
                queue.updateHeuristic({run: heuristic(80)});
                queue.intervalRunningStatus = false;
                await queue.add([stubTemplate()]);
                await _semaphore.done();
                console.log('done '); //eslint-disable-line
            });
            it('check events remove', async () => {
                queue.on(queueEvents.REMOVE, () => _semaphore.callDone());
                queue.updateHeuristic({run: heuristic(80)});
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
            after(() => {
                try {
                    clearCache(['../lib/queue']);
                }
                catch (e) {
                   
                }
            });
        });
    });
    
    describe('queue-runner', () => {
        let queueRunner = null;
        before(async () => {
            //   clearCache(['../lib/queue', '../bootstrap', '../lib/queue-runner']);
            bootstrap = require('../bootstrap'); //eslint-disable-line
            queueRunner = require('../lib/queue-runner'); //eslint-disable-line
             //eslint-disable-line
            await bootstrap.init();
        });
        it('check-that-heuristics-sets-to-latestScore', async () => {
            //  queue.updateHeuristic(heuristic(80));
            const stubJob = stubTemplate();
            await queueRunner.queue.add([stubJob]);
            await delay(500);
            const q = queueRunner.queue.get;
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

    after(() => {
    //    clearCache(['../lib/queue', '../bootstrap', '../lib/queue-runner']);
        console.log('--------cleared---------');
    });
});

describe('persistency tests', () => {
    let queueRunner = null;
    let bootstrap = null;
    before(async () => {
        console.log('------------------------------------');
        console.log('persistency tests');
        console.log('------------------------------------');
        //   clearCache(['../lib/queue', '../bootstrap', '../lib/queue-runner']);
       bootstrap = require('../bootstrap'); //eslint-disable-line
        console.log('queue runner b');
        try {
        queueRunner = require('../lib/queue-runner'); //eslint-disable-line
        }
        catch (e) {
            console.error('queue runner a');
        }   
        console.log('queue runner a');
         //eslint-disable-line
        await bootstrap.init();
    });
    it('persistent load', async () => {
        await queueRunner.queue.add(generateArr(100));
        await queueRunner.queue.persistenceStore();
        queueRunner.queue.flush();
        await queueRunner.queue.persistencyLoad();
        await delay(500);
        const q = queueRunner.queue.get;
        // expect(q.length).to.be.equal(100);
        queueRunner.queue.flush();
        await queueRunner.queue.persistenceStore();
        await delay(500);
    }); 
});
