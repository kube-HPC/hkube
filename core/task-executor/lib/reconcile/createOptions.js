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

    registry = registry ? registry + '/' : '';
    namespace = namespace && namespace !== 'library' ? namespace + '/' : '';
    tag = tag && tag !== 'latest' ? ':' + tag : '';

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

const setAlgorithmImage = (template, versions, registry) => {
    const imageName = template.algorithmImage;
    const imageParsed = parseImageName(imageName);
    if (registry) {
        imageParsed.registry = registry.registry;
    }
    if (imageParsed.tag) {
        return createImageName(imageParsed);
    }
    const version = versions && versions.versions.find(p => p.project === imageParsed.repository);
    if (version && version.tag) {
        imageParsed.tag = version.tag;
    }
    return createImageName(imageParsed);
};

const setPipelineDriverImage = (template, versions, registry) => {
    const imageName = template.image;
    const imageParsed = parseImageName(imageName);
    if (registry) {
        imageParsed.registry = registry.registry;
    }
    if (imageParsed.tag) {
        return createImageName(imageParsed);
    }
    const version = versions && versions.versions.find(p => p.project === imageParsed.repository);
    if (version && version.tag) {
        imageParsed.tag = version.tag;
    }
    return createImageName(imageParsed);
};

const _createContainerResourceByFactor = ({ cpu, mem } = {}, factor = 1) => {
    const cpuFactored = (cpu || 0.1) * factor;
    const memory = `${(mem || 4) * factor}Mi`;
    return { cpu: cpuFactored, memory };
};

const createContainerResource = (template) => {
    const requests = _createContainerResourceByFactor(template || {}, 1);
    const limits = _createContainerResourceByFactor(template || {}, 2);
    return { requests, limits };
};

const setWorkerImage = (template, versions, registry) => {
    const imageName = template.workerImage || 'hkube/worker';
    const imageParsed = parseImageName(imageName);
    if (registry) {
        imageParsed.registry = registry.registry;
    }
    if (imageParsed.tag) {
        return createImageName(imageParsed);
    }
    const version = versions && versions.versions.find(p => p.project === imageParsed.repository);
    if (version && version.tag) {
        imageParsed.tag = version.tag;
    }
    // return `${imageName}:${version.tag}`;
    return createImageName(imageParsed);
};

module.exports = {
    setWorkerImage,
    createContainerResource,
    setAlgorithmImage,
    setPipelineDriverImage,
    createImageName,
    parseImageName
};
