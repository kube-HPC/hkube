const isValidDeploymentName = (deploymentName) => {
    if (typeof deploymentName !== 'string') return false;

    const parts = deploymentName.split('.');
    if (parts.length < 1) return false;

    const isValid = parts.every((host) => {
        const hostRegex = /^(?!:\/\/)([a-zA-Z0-9]+|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])$/gi;

        return hostRegex.test(host);
    });

    return isValid;
};

const findVersion = ({ versions, repositoryName }) => {
    const version = versions && versions.versions.find(p => p.project === repositoryName);
    if (version && version.tag) {
        return version.tag;
    }
    return 'latest';
};
module.exports = {
    isValidDeploymentName,
    findVersion
};
