const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const algorithms = require('./mocks/algorithms');
let cleaner, storeManager, cleanerManager;

describe('Debugs', () => {
  before(async () => {
    storeManager = require('../../lib/helpers/store-manager');
    cleanerManager = require('../../lib/core/cleaner-manager');
    cleaner = cleanerManager.getCleaner('debug');
    await storeManager._db.algorithms.deleteMany({}, { allowNotFound: true });
    await storeManager._db.algorithms.createMany(algorithms);
  });
  it('should remove only unused debugs', async () => {
    const spyStop = sinon.spy(storeManager, "deleteAlgByName");
    await cleaner.clean();
    expect(spyStop.callCount).to.be.eq(1);
  });
});
