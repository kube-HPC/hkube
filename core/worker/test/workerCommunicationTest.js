const configIt = require('config.rf');
const Logger = require('logger.rf');
const VerbosityPlugin = require('logger.rf').VerbosityPlugin;


const messages = require('../lib/algorunnerCommunication/messages')
const expect = require('chai').expect
const sinon = require('sinon');
const workerCommunication = require('../lib/algorunnerCommunication/workerCommunication')
const socketioclient = require('socket.io-client');
const config = {
    workerCommunication:
    {
        adapterName: 'loopback',
        config: {}
    }
}
let log;
describe('worker communication', () => {
    before(async () => {
        const {main, logger} = await configIt.load();
        log = new Logger(main.serviceName, logger);
        log.plugins.use(new VerbosityPlugin(main.redis));
    })
    it('should create loopback adapter', async () => {

        await workerCommunication.init(config);
        expect(workerCommunication.adapter.constructor.name).to.equal('LoopbackWorkerCommunication')
    })
    it('should pass events', async () => {
        const spy = sinon.spy();
        await workerCommunication.init(config);
        const adapter = workerCommunication.adapter;
        workerCommunication.on(messages.incomming.ping, spy)
        adapter._loopback.emit(messages.incomming.ping, '1', '2');
        expect(spy.callCount).to.eq(1);
        expect(spy.getCall(0).args).to.eql(['1', '2'])
    })
})