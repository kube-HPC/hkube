const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const cleanerManager = require('../../lib/cleaner-manager');
let cleaner, kubernetes;

describe('Jobs', () => {
    before(async () => {
        cleaner = cleanerManager.getCleaner('jobs');
        kubernetes = require('./mocks/kubernetes');
    });
    it('should pass', async () => {
        const spy = sinon.spy(kubernetes, "deleteJob");
        await cleaner.clean();
        expect(spy.callCount).to.eql(6);
    });
});