const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const mockData = require('./mocks/jobs.json');
let cleaner, cleanerManager;

describe('Status', () => {
  before(async () => {
    storeManager = require('../../lib/helpers/store-manager');
    cleanerManager = require('../../lib/core/cleaner-manager');
    cleaner = cleanerManager.getCleaner('status');
    await storeManager._db.jobs.deleteMany({}, { allowNotFound: true });
    await storeManager._db.jobs.createMany(mockData);
  });
  it('should fix status of pipelines', async () => {
    await cleaner.clean()
    const jobsAfter = await storeManager._db.jobs.fetchAll({});
    expect(jobsAfter.length).to.be.eq(5);
    expect(jobsAfter[0].status.status).to.be.eq('active');
    expect(jobsAfter[1].status.status).to.be.eq('completed');
    expect(jobsAfter[2].status.status).to.be.eq('stopped');
    expect(jobsAfter[3].status.status).to.be.eq('completed');
    expect(jobsAfter[4].status.status).to.be.eq('completed');

  });
});
