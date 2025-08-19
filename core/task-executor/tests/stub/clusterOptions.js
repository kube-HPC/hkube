const clusterOptions = {
    useNodeSelector: false,
    ingressHost: '',
    ingressPrefix:'',
    ingressUseRegex: true,
    ingressClass: 'nginx',
    devModeEnabled: true,
    fluentbitSidecarEnabled: false,
    datasourcesServiceEnabled: true,
    optunaDashboardEnabled: true
}

module.exports = clusterOptions;