const objectPath = require('object-path');
const { parseImageName } = require('../helpers/images');

const normalizeDeployments = (deploymentsRaw) => {
    if (deploymentsRaw == null) {
        return [];
    }
    // deploymentsRaw.body.items[0].spec.template.spec.containers[0].image

    const deployments = deploymentsRaw.body.items.map(j => ({
        name: j.metadata.name,
        algorithmName: j.metadata.labels['algorithm-name'],
        image: parseImageName(objectPath.get(j, 'spec.template.spec.containers.0.image'))
    }));
    return deployments;
};
const normalizeAlgorithms = (algorithmsRaw) => {
    if (algorithmsRaw == null) {
        return [];
    }

    return algorithmsRaw;
};


module.exports = {
    normalizeDeployments,
    normalizeAlgorithms
};
