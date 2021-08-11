
const mockery = require('mockery');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { callCount, mock, clearCount } = (require('./mocks/kubernetes.mock')).kubernetes();
const driversTemplateStore = require('./stub/driversTemplateStore');

before(async () => {
    mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: false
    });
    mockery.registerMock('./helpers/kubernetes', mock);
    mockery.registerMock('../helpers/kubernetes', mock);
    mockery.registerMock('./kubernetes', mock);
    mockery.registerMock('./lib/helpers/kubernetes', mock);
    const bootstrap = require('../bootstrap');
    const etcd = require('../lib/helpers/etcd');
    const db = require('../lib/helpers/db');
    const config = await bootstrap.init();
    await etcd._etcd._client.delete('/', { isPrefix: true });
    await db._db.db.dropDatabase();
    await db._db.init();
    await db._db.pipelineDrivers.createMany(driversTemplateStore);

    global.testParams = {
        config,
        callCount,
        clearCount,
        kubernetesMock: mock
    }
});