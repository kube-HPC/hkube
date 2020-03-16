const settingsFactory = () => (
    {
        useResourceLimits: false,
        applyResources: false,
        labels: {}
    }
);

let settings = settingsFactory();

const setFromConfig = (config) => {
    settings = settingsFactory();
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
