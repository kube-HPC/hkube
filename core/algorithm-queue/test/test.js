const {expect} = require('chai');
const {genereateArr, stubTemplate} = require('./stub/stub');
const delay = require('await-delay');
const huristic = score => job => (Promise.resolve({...job, ...{calculated: {score, enternceTime: Date.now()}}}));
const randHuristic = score => job => (Promise.resolve({
    ...job, 
    ...{calculated: {score: Math.floor((Math.random() * 100)), enternceTime: Date.now()}}
}));
const Queue = require('../lib/queue');
let queue = null;
const QUEUE_INTERVAL = 500;

describe('queue-tests', () => {
    describe('add', () => {
        before(() => {
            queue = new Queue({updateInterval: QUEUE_INTERVAL});
        });
        it('should added to queue', async () => {
            queue.updateHuristic(huristic(80));
            await queue.add([stubTemplate()]);
            await delay(QUEUE_INTERVAL + 500);
            const q = queue.get;
            expect(q[0].calculated.score).to.eql(80);
        });
        it('should added to queue orderd', async () => {
            queue.updateHuristic(huristic(80));
            await queue.add([stubTemplate()]);
            queue.updateHuristic(huristic(60));
            await queue.add([stubTemplate()]);
            queue.updateHuristic(huristic(90));
            await queue.add([stubTemplate()]);
            expect(queue.get[0].calculated.score).to.eql(90);
            expect(queue.get[2].calculated.score).to.eql(60);
        });
    });
});
