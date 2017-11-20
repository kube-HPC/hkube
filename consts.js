const REPOS = {
    dev: 'dev',
    devShort: 'd',
    common: 'common',
    commonShort: 'c',
    all: 'all',
    allShort: 'a',
}


const GIT_PREFIX = {
    dev: "git@gitlab.com:greenapes/hkube/",
    common: "git@gitlab.com:greenapes/hkube-common"
}

const FOLDERS = {
    dev: `${process.env.HOME}/dev/hkube/`,
    common: `${process.env.HOME}/dev/hkube-common/`,

}

module.exports = {
    REPOS,
    GIT_PREFIX,
    FOLDERS
};