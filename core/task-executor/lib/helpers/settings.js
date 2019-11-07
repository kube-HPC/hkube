const settingsFactory = () => (
    {
        useResourceLimits: false,
        applyResources: false
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
};

module.exports = {
    settings,
    setFromConfig
};
