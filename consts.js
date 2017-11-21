const REPOS = {
    dev: 'dev',
    devShort: 'd',
    common: 'common',
    commonShort: 'c',
    all: 'all',
    allShort: 'a',
}


const GIT_PREFIX = {
    dev: "git@github.com:kube-HPC",
    common: "git@github.com:kube-HPC"
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