const clusterOptions = require('./clusterOptions')
const discoveryStub = require('./discoveryStub');
const jobs = require('./jobsRaw');
const twoCompleted = require('./jobsRawTwoCompleted');
const jobTemplate = require('./jobTemplates');
const normResources = require('./normalizedResources');
const normalizedStub = require('./normalizedStub');
const pods = require('./podsRaw');
const resources = require('./resources');
const templateStore = require('./templateStore');
const versions = require('./versions');
const workers = require('./workersRaw');

module.exports = {
    clusterOptions,
    ...discoveryStub,
    jobs,
    twoCompleted,
    jobTemplate,
    normResources,
    ...normalizedStub,
    pods,
    resources,
    templateStore,
    versions,
    workers,
}