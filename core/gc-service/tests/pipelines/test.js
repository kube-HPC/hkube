const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const nock = require('nock');
const apiServer = require('../../lib/cleaners/pipelines/api-server-client');
let cleaner, cleanerManager;

describe('Pipelines', () => {
  before(async () => {
    nock('http://localhost:3000')
      .persist()
      .post('/internal/v1/exec/stop')
      .reply(200);
    cleanerManager = require('../../lib/core/cleaner-manager');
    cleaner = cleanerManager.getCleaner('pipelines');
  });
  it('should clean only expired pipelines', async () => {
    const spyStop = sinon.spy(apiServer, "stop");
    await cleaner.clean();
    expect(spyStop.callCount).to.be.greaterThan(1);
  });
});
