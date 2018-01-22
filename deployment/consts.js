const _defaultYamlPath = `${process.env.HOME}/dev/hkube/deployment/kubernetes/yaml.cluster`
const YAML_PATH = {
    core: `${_defaultYamlPath}/core`,
    thirdParty: `${_defaultYamlPath}/thirdParty`,
}

module.exports = {
    YAML_PATH
}