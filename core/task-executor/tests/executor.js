const { expect } = require('chai');
const sinon = require('sinon');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const config = main;

describe('executor', () => {
    describe('executor', () => {
        it('should run interval successfully', async () => {
            const executor = require('../lib/executor');
            const spy1 = sinon.spy(executor, '_interval');
            const spy2 = sinon.spy(executor, '_algorithmsHandle');

            await executor.init(config);

            expect(spy1.callCount).to.eql(1);
            expect(spy2.callCount).to.eql(1);
        });
    });

    describe('_interval', () => {
        let Executor, kubernetes, sandbox, options;
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        before(() => {
            Executor = require('../lib/executor').constructor;
            kubernetes = global.testParams.kubernetesMock;
            options = { ...config, resources: { worker: {} } };
        });
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });

        const createExecutor = () => {
            const executor = new Executor();
            executor._intervalMs = 1000;
            executor._interval = () => { };
            executor._algorithmsHandle = sandbox.stub().resolves();
            executor._getContainerDefaults = sandbox.stub().resolves({});
            const scheduled = [];
            const realSetTimeout = global.setTimeout;
            sandbox.stub(global, 'setTimeout').callsFake((fn, ms, ...args) => {
                if (fn === executor._interval) {
                    scheduled.push({ at: Date.now(), ms });
                    return null;
                }
                return realSetTimeout(fn, ms, ...args);
            });
            const run = () => Executor.prototype._interval.call(executor, options);
            return { executor, run, scheduled };
        };

        it('should schedule next cycle only after both kubernetes calls settled, even when one fails fast', async () => {
            let slowDoneAt;
            sandbox.stub(kubernetes, 'getVersionsConfigMap').rejects(new Error('getVersionsConfigMap timeout'));
            sandbox.stub(kubernetes, 'getResourcesPerNode').callsFake(async () => {
                await delay(100);
                slowDoneAt = Date.now();
                return {};
            });
            const { executor, run, scheduled } = createExecutor();
            await run();
            expect(scheduled).to.have.lengthOf(1);
            expect(slowDoneAt).to.be.a('number');
            expect(scheduled[0].at).to.be.at.least(slowDoneAt);
            expect(executor._algorithmsHandle.called).to.eql(false);
        });

        it('should run algorithms handle when both kubernetes calls succeed', async () => {
            sandbox.stub(kubernetes, 'getVersionsConfigMap').resolves({ versions: {}, registry: {}, clusterOptions: {} });
            sandbox.stub(kubernetes, 'getResourcesPerNode').resolves({});
            const { executor, run, scheduled } = createExecutor();
            await run();
            expect(executor._algorithmsHandle.calledOnce).to.eql(true);
            expect(scheduled).to.have.lengthOf(1);
        });
    });

    describe('_getContainerDefaults', () => {
        let executor, settings, originalApplyResources;

        before(() => {
            executor = require('../lib/executor');
            ({ settings } = require('../lib/helpers/settings'));
        });

        beforeEach(() => {
            originalApplyResources = settings.applyResources;
            global.testParams.clearCount();
        });

        afterEach(() => {
            settings.applyResources = originalApplyResources;
        });

        it('should not fetch LimitRanges when worker resources are applied', async () => {
            settings.applyResources = true;
            const res = await executor._getContainerDefaults();
            expect(res).to.eql({});
            expect(global.testParams.callCount('getContainerDefaultResources')).to.be.undefined;
        });

        it('should fetch LimitRanges when worker resources are not applied', async () => {
            settings.applyResources = false;
            const res = await executor._getContainerDefaults();
            expect(res).to.have.keys('cpu', 'memory');
            expect(global.testParams.callCount('getContainerDefaultResources')).to.have.lengthOf(1);
        });
    });
});
