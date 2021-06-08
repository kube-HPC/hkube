const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const algorithms = require('./mocks/algorithms');
const cleanerManager = require('../../lib/cleaner-manager');
let cleaner, storeManager

describe('Gateways', () => {
  before(async () => {
    storeManager = require('../../lib/utils/store-manager');
    cleaner = cleanerManager.getCleaner('gateway');
    await storeManager._db.algorithms.deleteMany({}, { allowNotFound: true });
    await storeManager._db.algorithms.createMany(algorithms);
  });
  it('should remove only unused gateways', async () => {
    const spyStop = sinon.spy(storeManager, "deleteAlgByName");
    await cleaner.clean();
    expect(spyStop.callCount).to.be.eq(1);
  });
});
