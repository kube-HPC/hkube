const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
let cleaner, kubernetes, cleanerManager;

describe('Jobs', () => {
    before(async () => {
        cleanerManager = require('../../lib/core/cleaner-manager');
        cleaner = cleanerManager.getCleaner('jobs');
        kubernetes = require('./mocks/kubernetes');
    });
    it('should pass', async () => {
        const spy = sinon.spy(kubernetes, "deleteJob");
        await cleaner.clean();
        expect(spy.callCount).to.eql(6);
    });
});