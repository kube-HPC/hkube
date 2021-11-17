
const mockery = require('mockery');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const kubernetesMock = (require('./mocks/kubernetes.mock')).kubernetes();
const jupyterApiMock = (require('./mocks/jupyterhub.mock')).jupyterApi();
const driversTemplateStore = require('./stub/driversTemplateStore');

before(async () => {
    mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: false
    });
    mockery.registerMock('./helpers/kubernetes', kubernetesMock.mock);
    mockery.registerMock('../helpers/kubernetes', kubernetesMock.mock);
    mockery.registerMock('./kubernetes', kubernetesMock.mock);
    mockery.registerMock('./lib/helpers/kubernetes', kubernetesMock.mock);
    mockery.registerMock('./jupyterApi', jupyterApiMock.mock);
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
        kubernetes: kubernetesMock,
        jupyterhub: jupyterApiMock,
    }
});