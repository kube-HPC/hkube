const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const algorithms = require('./mocks/algorithms');
let cleaner, storeManager, cleanerManager;

describe('Output', () => {
  before(async () => {
    storeManager = require('../../lib/helpers/store-manager');
    cleanerManager = require('../../lib/core/cleaner-manager');
    cleaner = cleanerManager.getCleaner('output');
    await storeManager._db.algorithms.deleteMany({}, { allowNotFound: true });
    await storeManager._db.algorithms.createMany(algorithms);
  });
  it('should remove only unused outputs', async () => {
    const spyStop = sinon.spy(storeManager, "deleteAlgByName");
    await cleaner.clean();
    expect(spyStop.callCount).to.be.eq(1);
  });
});
