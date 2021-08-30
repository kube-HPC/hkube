const settingsFactory = () => (
    {
        useResourceLimits: false,
        applyResourceLimits: false,
        resourcesMain: {
            memory: 256,
            cpu: 0.2,
        },
        resourcesBuilder: {
            memory: 256,
            cpu: 1,
        },
        sidecars: []

    }
);

const settings = settingsFactory();

const setFromConfig = (config) => {
    if (!config) {
        return;
    }
    settings.useResourceLimits = config.resources.useResourceLimits;
    settings.applyResourceLimits = config.resources.enable;
    settings.resourcesMain = config.resources.algorithmBuilderMain;
    settings.resourcesBuilder = config.resources.algorithmBuilderBuilder;
};

module.exports = {
    settings,
    setFromConfig
};
