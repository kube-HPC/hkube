const fs = require('fs-extra');
const sinon = require('sinon');
const mockery = require('mockery');
const executions = require('./pipelines/mocks/executions');
let config;

before(async function () {
    this.timeout(15000);
    mockery.enable({
        useCleanCache: false,
        warnOnReplace: false,
        warnOnUnregistered: false
    });
    mockery.registerSubstitute('./lib/utils/kubernetes', `${process.cwd()}/tests/jobs/mocks/kubernetes.js`);
    mockery.registerSubstitute('../../utils/kubernetes', `${process.cwd()}/tests/jobs/mocks/kubernetes.js`);
    mockery.registerSubstitute('./lib/utils/etcd', `${process.cwd()}/tests/etcd/mocks/etcd-store.js`);
    mockery.registerSubstitute('../../utils/etcd', `${process.cwd()}/tests/etcd/mocks/etcd-store.js`);
    mockery.registerSubstitute('./lib/utils/redis', `${process.cwd()}/tests/redis/mocks/redis-store.js`);
    mockery.registerSubstitute('../../utils/redis', `${process.cwd()}/tests/redis/mocks/redis-store.js`);
    const bootstrap = require('../bootstrap');
    config = await bootstrap.init();
    const storeManager = require('../lib/utils/store-manager');
    await storeManager._db.db.dropDatabase();
    await storeManager._db.init();
    await storeManager._db.jobs.createMany(executions.map((e, i) => ({ jobId: `job-${i}`, pipeline: e })));

    global.testParams = {
        config
    }
});


after(async () => {
    await fs.remove(config.fs.baseDirectory);
});

afterEach(() => {
    sinon.restore();
});
