const settingsFactory = () => (
    {
        useResourceLimits: false,
        applyResources: false,
        labels: {},
        sidecars: []
    }
);

const settings = settingsFactory();

const setFromConfig = (config) => {
    if (!config) {
        return;
    }
    settings.useResourceLimits = config.resources.useResourceLimits;
    settings.applyResources = config.resources.enable;
    settings.labels = config.kubernetes.labels;
};

module.exports = {
    settings,
    setFromConfig
};
