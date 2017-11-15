const _defaultYamlPath = `${process.env.HOME}/dev/hkube/common/scripts/kubernetes/yaml`
const YAML_PATH = {
    core: `${_defaultYamlPath}/core`,
    thirdParty: `${_defaultYamlPath}/thirdParty`,

}

const MINIKUBE = {
    init: `init`,
    start: `start`,
    restart: `restart`,
    cleanAndRestartMinikube: `cleanAndRestartMinikube`,
    initAndStart: `initAndSrart`



}

const URL_PATH = {
    minikube: {
        path: `${process.env.HOME}/dev/hkube-minikube/`,
        url: `https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64`,
        name: `minikube`,
    },
    kubectl: {
        path: `${process.env.HOME}/dev/hkube-minikube/`,
        url: `https://storage.googleapis.com/kubernetes-release/release/v1.8.0/bin/linux/amd64/kubectl`,
        name: `kubectl`
    },
}

const GITLAB = {
    user: `maty21`,
    token: `8D-om2i9raYM_7oKiHGR`,
    email: `maty21@gmail.com`
}

const VM = { ip: `192.168.99.100`, port: '8443' };

const REGISTRY = `registry.gitlab.com/greenapes/hkube/registry`;


module.exports = { YAML_PATH, URL_PATH, VM, REGISTRY, GITLAB, MINIKUBE };