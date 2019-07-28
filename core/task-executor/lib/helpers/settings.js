const settingsFactory = () => (
    {
        useResourceLimits: false
    }
);

let settings = settingsFactory();

const setFromConfig = (config) => {
    settings = settingsFactory();
    if (!config) {
        return;
    }
    settings.useResourceLimits = config.resources.useResourceLimits;
};

module.exports = {
    settings,
    setFromConfig
};
