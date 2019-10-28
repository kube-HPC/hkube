const hkube = require('./github-commit.json');

const urls = {
    'hkube': hkube,
    'my.git.foo.bar': hkube,
    'statistisc': hkube
}

class Octokit {

    constructor() {
        this.repos = {
            listCommits: (params) => {
                const repo = urls[params.repo];
                if (!repo) {
                    throw new Error('Git Repository is empty.');
                }
                return repo;
            }
        }
    }
}

module.exports = Octokit;
