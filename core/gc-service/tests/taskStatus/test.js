const chai = require('chai');
const { expect } = chai;

describe('Task Status', () => {
    before(async () => {
        storeManager = require('../../lib/helpers/store-manager');
        cleanerManager = require('../../lib/core/cleaner-manager');
        cleaner = cleanerManager.getCleaner('taskStatus');
    });
    it.skip('should change status to warning in db', async () => {

    })
})