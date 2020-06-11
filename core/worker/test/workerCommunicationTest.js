const stateManager = require('../lib/states/stateManager');
global.stateManager = stateManager;
const messages = require('../lib/algorithm-communication/messages');
const { expect } = require('chai');
const sinon = require('sinon');
const workerCommunication = require('../lib/algorithm-communication/workerCommunication');
const config = {
    workerCommunication: {
        adapterName: 'loopback'
    }
};
describe('worker communication', () => {
    before(async () => {
        await workerCommunication.init(config);
    });
    it('should create loopback adapter', async () => {
        await workerCommunication.init(config);
        expect(workerCommunication.adapter.constructor.name).to.equal('Loopback');
    });
    it('should pass events', async () => {
        const spy = sinon.spy();
        const { adapter } = workerCommunication;
        workerCommunication.on(messages.incomming.started, spy);
        adapter.emit(messages.incomming.started, ['1', '2']);
        expect(spy.callCount).to.eq(1);
        expect(spy.getCall(0).args[0]).to.eql(['1', '2']);
    });
    xit('should pass message.command events', async () => {
        const spy = sinon.spy();
        expect(stateManager.state).to.equal('bootstrap');
        stateManager.bootstrap();
        stateManager.prepare();
        expect(stateManager.state).to.equal('init');
        const { adapter } = workerCommunication;
        workerCommunication.on(messages.incomming.initialized, spy);
        adapter.send({ command: messages.outgoing.initialize, data: { xxx: 'yyy' } });
        expect(spy.callCount).to.eq(1);
        expect(spy.getCall(0).args[0]).to.eql({ xxx: 'yyy' });
    });
});
