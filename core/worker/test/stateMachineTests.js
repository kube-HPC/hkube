const stateMachine = require('../lib/states/stateManager');
const { stateEvents, workerStates } = require('../lib/consts');
const delay = require('delay');
const { expect } = require('chai');
const sinon = require('sinon');
const stateAdapter = require('../lib/states/stateAdapter');
const jobConsumer = require('../lib/consumer/JobConsumer');

describe('state machine', () => {
    beforeEach(() => {
        stateMachine._initStateMachine();
    });
    it('should set inititial state to bootstrap', () => {
        expect(stateMachine.state).to.eql(workerStates.bootstrap);
    });
    it('should set inititial state to ready', () => {
        stateMachine.bootstrap();
        expect(stateMachine.state).to.eql(workerStates.ready);
    });
    it('should transition from ready to init', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        expect(stateMachine.state).to.eql(workerStates.init);
    });
    it('should transition from init to working', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        expect(stateMachine.state).to.eql(workerStates.working);
    });
    it('should transition from working to results', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.done();
        expect(stateMachine.state).to.eql(workerStates.results);
    });
    it('should transition from results to ready', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.done();
        stateMachine.cleanup();
        expect(stateMachine.state).to.eql(workerStates.ready);
    });
    it('should raise event on state enter', () => {
        stateMachine.bootstrap();
        const spy = sinon.spy();
        stateMachine.on(stateEvents.stateEntered, spy);
        stateMachine.prepare();
        expect(spy.callCount).to.eql(1);
        stateMachine.start();
        expect(spy.callCount).to.eql(2);
        stateMachine.done();
        expect(spy.callCount).to.eql(3);
        stateMachine.cleanup();
        expect(spy.callCount).to.eql(4);
        expect(stateMachine.state).to.eql(workerStates.ready);
    });
    xit('could not pause if algorithm not running', async () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.done();
        stateAdapter.workers.set({ workerId: stateAdapter.discovery._instanceId, status: { command: 'stopProcessing' } });
        await delay(600);
        expect(jobConsumer._consumerPaused).to.eql(false);
    });
    it('should fail to transition from ready to working', () => {
        expect(stateMachine.start).to.throw();
    });
});
