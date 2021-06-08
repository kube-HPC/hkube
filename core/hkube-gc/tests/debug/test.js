const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const algorithms = require('./mocks/algorithms');
const cleanerManager = require('../../lib/cleaner-manager');
let cleaner, storeManager;

describe('Debugs', () => {
  before(async () => {
    storeManager = require('../../lib/utils/store-manager');
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
