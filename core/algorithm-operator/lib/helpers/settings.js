const settingsFactory = () => (
    {
        applyResourceLimits: false,
        resourcesMain: {
            memory: 256,
            cpu: 0.2,
        },
        resourcesBuilder: {
            memory: 256,
            cpu: 1,
        }
    }
);

const settings = settingsFactory();

const setFromConfig = (config) => {
    if (!config) {
        return;
    }
    settings.applyResourceLimits = config.resources.enable;
    settings.resourcesMain = config.resources.algorithmBuilderMain;
    settings.resourcesBuilder = config.resources.algorithmBuilderBuilder;
};

module.exports = {
    settings,
    setFromConfig
};
