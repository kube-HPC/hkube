

const normalizeDeployments = (deploymentsRaw) => {
    if (deploymentsRaw == null) {
        return [];
    }
    const deployments = deploymentsRaw.body.items.map(j => ({
        name: j.metadata.name,
        algorithmName: j.metadata.labels['algorithm-name'],
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
