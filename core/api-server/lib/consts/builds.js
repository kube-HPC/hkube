const BUILD_TRIGGERS = ['checksum', 'env', 'commit', 'baseImage', 'dependencyInstallCmd'];

const BUILD_GUIDE = 'use the Hkube dashboard or the Hkube API to follow the build progress';

const MESSAGES = {
    FORCE_BUILD: `a build was triggered due to force flag. ${BUILD_GUIDE}`,
    FIRST_BUILD: `a build was triggered due to first algorithm update. ${BUILD_GUIDE}`,
    TRIGGER_BUILD: `a build was triggered due to change in {triggers}. ${BUILD_GUIDE}`,
    ALGORITHM_PUSHED: 'the algorithm {algorithmName} has been successfully pushed to hkube',
    VERSION_CREATED: 'a new version of algorithm {algorithmName} has been created',
    NO_TRIGGER_FOR_BUILD: `there was no trigger for build, no change in ${BUILD_TRIGGERS.join(',')}`,
    APPLY_ERROR: 'cannot apply algorithm due to missing image url or build data',
};

const WEBHOOKS = {
    GITHUB: 'github',
    GITLAB: 'gitlab'
};

module.exports = {
    BUILD_TRIGGERS,
    MESSAGES,
    WEBHOOKS
};
