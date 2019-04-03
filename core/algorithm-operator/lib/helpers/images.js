const parseImageName = (image) => {
    const match = image.match(/^(?:([^/]+)\/)?(?:([^/]+)\/)?([^@:/]+)(?:[@:](.+))?$/);
    if (!match) return null;

    let registry = match[1];
    let namespace = match[2];
    const repository = match[3];
    let tag = match[4];

    if (!namespace && registry && !/[:.]/.test(registry)) {
        namespace = registry;
        registry = null;
    }

    const result = {
        registry: registry || null,
        namespace: namespace || null,
        repository,
        tag: tag || null
    };

    registry = registry ? `${registry}/` : '';
    namespace = namespace && namespace !== 'library' ? `${namespace}/` : '';
    tag = tag && tag !== 'latest' ? `:${tag}` : '';

    result.name = registry + namespace + repository + tag;
    result.fullname = registry + (namespace || 'library/') + repository + (tag || ':latest');

    return result;
};

const createImageName = ({ registry, namespace, repository, tag }, ignoreTag) => {
    let array = [registry, namespace, repository];
    array = array.filter(a => a);
    let image = array.join('/');
    if (tag && !ignoreTag) {
        image = `${image}:${tag}`;
    }
    return image;
};

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
    createImageName,
    parseImageName,
    isValidDeploymentName,
    findVersion
};
