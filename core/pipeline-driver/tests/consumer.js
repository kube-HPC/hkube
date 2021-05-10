

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const { delay } = require('./utils');
let consumer, stateManager;

describe('Consumer', function () {
    before(async () => {
        stateManager = require('../lib/state/state-manager');
        consumer = require('../lib/consumer/jobs-consumer');
    });
    describe('pause', function () {
        it('should pause', async function () {
            const spy = sinon.spy(consumer, "_stopProcessing");
            await delay(200);
            await stateManager._etcd.drivers.set({ driverId: stateManager._driverId, status: { command: 'stopProcessing' } });
            await delay(200);
            expect(spy.called).to.equal(true);
        });
    });
});