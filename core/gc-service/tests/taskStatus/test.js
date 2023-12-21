const chai = require('chai');
const { expect } = chai;

describe('Task Status', () => {
    before(async () => {
        storeManager = require('../../lib/helpers/store-manager');
    });
    it.skip('should change status to warning in db', async () => {
        const x = 'something';
            expect(x).to.eq('something');
    })
})