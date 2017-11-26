const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const VerbosityPlugin = require('@hkube/logger').VerbosityPlugin;

const stateMachine = require('../lib/states/stateManager')
const { stateEvents } = require('../common/consts/events');

const { workerStates } = require('../common/consts/states')
const { expect } = require('chai')
const sinon = require('sinon');
let log;
describe('state machine', () => {
    before(async () => {
        const {main, logger} = await configIt.load();
        log = new Logger(main.serviceName, logger);
        log.plugins.use(new VerbosityPlugin(main.redis));
        await stateMachine.init(main);
        // await discovery.init(main)


        // process.on('unhandledRejection', (error) => {
        //     console.error('unhandledRejection: ' + error.message);
        // });
        // process.on('uncaughtException', (error) => {
        //     console.error('uncaughtException: ' + error.message);
        // });

    })

    beforeEach(() => {
        stateMachine._initStateMachine();
    });
    it('should set inititial state to bootstrap', () => {
        expect(stateMachine.state).to.eql(workerStates.bootstrap)
    });
    it('should set inititial state to ready', () => {
        stateMachine.bootstrap();
        expect(stateMachine.state).to.eql(workerStates.ready)
    });
    it('should transition from ready to init', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        expect(stateMachine.state).to.eql(workerStates.init)
    });
    it('should transition from init to working', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        expect(stateMachine.state).to.eql(workerStates.working)
    });
    it('should transition from working to shutdown', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.finish();
        expect(stateMachine.state).to.eql(workerStates.shutdown)
    });
    it('should transition from shutdown to ready', () => {
        stateMachine.bootstrap();
        stateMachine.prepare();
        stateMachine.start();
        stateMachine.finish();
        stateMachine.done();
        expect(stateMachine.state).to.eql(workerStates.ready)
    });
    it('should raise event on state enter', () => {
        stateMachine.bootstrap();
        const spy = sinon.spy();
        stateMachine.on(stateEvents.stateEntered,spy);
        stateMachine.prepare();
        expect(spy.callCount).to.eql(1);
        stateMachine.start();
        expect(spy.callCount).to.eql(2);
        stateMachine.finish();
        expect(spy.callCount).to.eql(3);
        stateMachine.done();
        expect(spy.callCount).to.eql(4);
        expect(stateMachine.state).to.eql(workerStates.ready)
    });
    it('should fail to transition from ready to working', () => {
        expect(stateMachine.start).to.throw()
    });
})
