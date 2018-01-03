const {expect} = require('chai');
const {genereateArr, stubTemplate} = require('./stub/stub');
const delay = require('await-delay');
const querier = require('../lib/querier');
const heuristic = score => job => (Promise.resolve({...job, ...{calculated: {score, enternceTime: Date.now()}}}));
const randomHeuristic = score => job => (Promise.resolve({
    ...job, 
    ...{calculated: {score: Math.floor((Math.random() * 100)), enternceTime: Date.now()}}
}));
const Queue = require('../lib/queue');
let queue = null;
const QUEUE_INTERVAL = 500;

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
        it('should added to queue orderd', async () => {
            queue.updateHeuristic(heuristic(80));
            await queue.add([stubTemplate()]);
            queue.updateHeuristic(heuristic(60));
            await queue.add([stubTemplate()]);
            queue.updateHeuristic(heuristic(90));
            await queue.add([stubTemplate()]);
            console.log('queue status', querier(queue.get).getScoreJobIdArray());
            expect(queue.get[0].calculated.score).to.eql(90);
            expect(queue.get[2].calculated.score).to.eql(60);
            queue.intervalRunningStatus = false;
        });
    });
});
