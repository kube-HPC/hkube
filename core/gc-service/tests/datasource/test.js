const sinon = require('sinon');
const fse = require('fs-extra');
const path = require('path');
const uuid = require('uuid');
const { expect } = require('chai');
let cleaner, storeManager, cleanerManager;

describe('DataSource', () => {
    before(() => {
        storeManager = require('../../lib/helpers/store-manager');
        cleanerManager = require('../../lib/core/cleaner-manager');
        cleaner = cleanerManager.getCleaner('datasource');
    });
    it('should perform cleanup', async () => {
        const prepare = node => ({
            id: uuid.v1(),
            nodes: [{ spec: node }],
        });
        const activeNodes = [
            { id: 'still-active' },
            { name: 'not-to-clean', snapshot: { name: 'x' } },
        ].map(prepare);
        const inactiveNodes = [
            { id: 'still-active' }, // under a
            { id: 'should-be-cleaned' }, // under b
            { name: 'not-to-clean', snapshot: { name: 'x' } },
            { name: 'to-clean', snapshot: { name: 'x' } },
        ].map(prepare);

        const removeStub = sinon.fake.resolves();
        sinon.replace(fse, 'remove', removeStub);
        sinon.replace(storeManager, 'scanMountedDataSources', ({ returnActiveJobs }) => returnActiveJobs ? activeNodes : inactiveNodes);
        const mountingDir = path.resolve(__dirname, 'mocks', 'mountedDataSources');
        cleaner.rootDir = mountingDir;
        await cleaner.clean();
        const calls = removeStub.getCalls();
        expect(calls).to.have.lengthOf(2);
        expect(calls[0].firstArg).to.match(/b\/should-be-cleaned/i);
        expect(calls[1].firstArg).to.match(/to-clean\/x/i);
    });
});
