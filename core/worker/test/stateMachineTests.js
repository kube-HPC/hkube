const stateMachine = require('../lib/states/stateManager')
const { workerStates } = require('../common/consts/states')
const { expect } = require('chai')
describe('state machine', () => {
    beforeEach(() => {
        stateMachine._initStateMachine();
    });
    it('should set inititial state to ready', () => {
        expect(stateMachine.state).to.eql(workerStates.ready)
    });
    it('should transition from ready to init', () => {
        stateMachine.prepare();
        expect(stateMachine.state).to.eql(workerStates.init)
    });
    it('should transition from init to working', () => {
        stateMachine.prepare();
        stateMachine.start();
        expect(stateMachine.state).to.eql(workerStates.working)
    });
    it('should transition from working to shutdown', () => {
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.finish();
        expect(stateMachine.state).to.eql(workerStates.shutdown)
    });
    it('should transition from shutdown to ready', () => {
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.finish();
        stateMachine.done();
        expect(stateMachine.state).to.eql(workerStates.ready)
    });
    it('should fail to transition from ready to working', () => {
        expect(stateMachine.start).to.throw()
    });
})
