
const mockery = require('mockery');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const etcd = require('../lib/helpers/etcd');
const { callCount, mock, clearCount } = (require('./mocks/kubernetes.mock')).kubernetes();
const templateStore = require('./stub/templateStore');
const driversTemplateStore = require('./stub/driversTemplateStore');

before(async () => {
    mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: false
    });
    mockery.registerMock('./helpers/kubernetes', mock);
    mockery.registerMock('../helpers/kubernetes', mock);
    mockery.registerMock('./lib/helpers/kubernetes', mock);
    const bootstrap = require('../bootstrap');
    await bootstrap.init();
    await etcd._etcd._client.delete('/', { isPrefix: true });

    await etcd._db.algorithms.createMany(templateStore);
    await etcd._db.pipelineDrivers.createMany(driversTemplateStore);

    global.testParams = {
        callCount,
        clearCount
    }
});