const buildStatus = require('./buildStatus');
const commands = require('./commands');
const components = require('./componentNames');
const containers = require('./containers');
const deploymentTypes = require('./DeploymentTypes');
const kubernetesKinds = require('./kubernetes-kind-prefix');
const queueActions = require('./queue-actions');

module.exports = {
    buildStatus,
    commands,
    components,
    containers,
    deploymentTypes,
    kubernetesKinds,
    queueActions
};
