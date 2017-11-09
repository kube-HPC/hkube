const { REPOS, GIT_PREFIX, FOLDERS } = require('./consts');
const { commonReposNames, reposNames } = require('./repos');


const _stringToRepo = (r) => {
    switch (r) {
        case REPOS.dev:
            return [{
                folder: FOLDERS.dev,
                git: GIT_PREFIX.dev,
                repo: reposNames
            }];
        case REPOS.common:
            return [{
                folder: FOLDERS.common,
                git: GIT_PREFIX.common,
                repo: commonReposNames
            }];
        case REPOS.all:

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
            return null;

    }

}


module.exports = _stringToRepo;
