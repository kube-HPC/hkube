const { utils } = require('@hkube/kubernetes-client');

const applyImage = (inputSpec, containerName, versions, registry) => {
    const image = utils.createImageFromContainer(inputSpec, containerName, versions, registry);
    const spec = utils.applyImage(inputSpec, image, containerName);
    return spec;
};

module.exports = {
    applyImage
};
