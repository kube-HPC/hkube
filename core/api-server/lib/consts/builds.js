
const BUILD_TRIGGERS = ['checksum', 'env'];

const BUILD_GUIDE = 'use the Hkube dashboard or the Hkube API api/v1/builds/status/<buildId> to follow the build progress';

const MESSAGES = {
    FIRST_BUILD: `a build was triggered due to first algorithm update. ${BUILD_GUIDE}`,
    TRIGGER_BUILD: `a build was triggered due to change in {triggers}. ${BUILD_GUIDE}`,
    ALGORITHM_PUSHED: 'the algorithm {algorithmName} has been successfully pushed to hkube',
    FILE_AND_IMAGE: 'both image and file is not allowed, the current image will be overwritten after build',
    NO_FILE_FOR_BUILD: 'there was no trigger for build, file was not supplied',
    NO_BUILD: 'there was no trigger for build, file or git repository was not supplied',
    NO_GIT_REPO_FOR_BUILD: 'there was no trigger for build, git repository was not supplied',
    NO_TRIGGER_FOR_BUILD: `there was no trigger for build, no change in ${BUILD_TRIGGERS.join(',')}`,
    APPLY_ERROR: 'cannot apply algorithm due to missing image url or build data',
};

const WEBHOOKS = {
    GITHUB: 'github',
    GITLAB: 'gitlab'
};

const BUILD_TYPES = {
    CODE: 'Code',
    IMAGE: 'Image',
    GIT: 'Git'

};
module.exports = {
    BUILD_TRIGGERS,
    MESSAGES,
    WEBHOOKS,
    BUILD_TYPES
};
