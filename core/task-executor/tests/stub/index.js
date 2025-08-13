const discoveryStub = require('./discoveryStub');
const jobs = require('./jobsRaw');
const twoCompleted = require('./jobsRawTwoCompleted');
const jobTemplate = require('./jobTemplates');
const normalizedStub = require('./normalizedStub');
const pods = require('./podsRaw');
const resources = require('./resources');
const templateStore = require('./templateStore');
const versions = require('./versions');
const workers = require('./workersRaw');

module.exports = {
    ...discoveryStub,
    jobs,
    twoCompleted,
    jobTemplate,
    ...normalizedStub,
    pods,
    resources,
    templateStore,
    versions,
    workers,
}