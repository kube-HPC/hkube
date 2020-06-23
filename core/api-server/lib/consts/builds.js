const BUILD_TRIGGERS = ['checksum', 'env'];

const BUILD_GUIDE = 'use the Hkube dashboard or the Hkube API api/v1/builds/status/<buildId> to follow the build progress';

const MESSAGES = {
    FIRST_BUILD: `a build was triggered due to first algorithm update. ${BUILD_GUIDE}`,
    TRIGGER_BUILD: `a build was triggered due to change in {triggers}. ${BUILD_GUIDE}`,
    ALGORITHM_PUSHED: 'the algorithm {algorithmName} has been successfully pushed to hkube',
    VERSION_CREATED: 'a new version of algorithm {algorithmName} has been created',
    FILE_AND_IMAGE: 'both image and file is not allowed, the current image will be overwritten after build',
    GIT_AND_IMAGE: 'both image and git repo is not allowed, the current image will be overwritten after build',
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
