const { REPOS, GIT_PREFIX, FOLDERS } = require('./consts');
const { commonReposNames, reposNames } = require('./repos');


const _stringToRepo = (r) => {
    switch (r) {
        case REPOS.dev:
        case REPOS.devShort:
            return [{
                folder: FOLDERS.dev,
                git: GIT_PREFIX.dev,
                repo: reposNames
            }];
        case REPOS.common:
        case REPOS.commonShort:
            return [{
                folder: FOLDERS.common,
                git: GIT_PREFIX.common,
                repo: commonReposNames
            }];
        case REPOS.all:
        case REPOS.allShort:
            return [
                {
                    folder: FOLDERS.dev,
                    git: GIT_PREFIX.dev,
                    repo: reposNames
                },
                {
                    folder: FOLDERS.common,
                    git: GIT_PREFIX.common,
                    repo: commonReposNames
                }
            ];
        default:
            return [
                {
                    folder: FOLDERS.dev,
                    git: GIT_PREFIX.dev,
                    repo: reposNames
                },
                {
                    folder: FOLDERS.common,
                    git: GIT_PREFIX.common,
                    repo: commonReposNames
                }
            ];
    }

}


module.exports = _stringToRepo;
