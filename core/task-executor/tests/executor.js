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
