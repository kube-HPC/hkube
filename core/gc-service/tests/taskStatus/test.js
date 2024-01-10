const chai = require('chai');
const { expect } = chai;
const etcdMock = require('../etcd/mocks/etcd-store')
const executions = require('../pipelines/mocks/executions');

describe('Task Status', () => {
    before(async () => {
        storeManager = require('../../lib/helpers/store-manager');
        cleanerManager = require('../../lib/core/cleaner-manager');
        cleaner = cleanerManager.getCleaner('taskStatus');
        await storeManager._db.jobs.createMany(executions.map((e, i) => (
            { 
                jobId: `job-${i}`,
                pipeline: e.pipeline,
                pdIntervalTimestamp: e.pdIntervalTimestamp,
                graph: e.graph 
            })));
    });
    it('should change status to warning in db', async () => {
        etcdMock.reset();
        jobIds = await cleaner.clean(1000);
        expect(jobIds.length).to.equal(2);
        
    })
})