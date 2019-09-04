const Octokit = require('@octokit/rest');
const Logger = require('@hkube/logger');
const component = require('../../consts/componentNames');
const { WEBHOOKS, BUILD_TYPES } = require('../../consts/builds');

const log = Logger.GetLogFromContanier();
class GitDataAdapter {
    constructor() {
        this.adapterRegister = {
            [WEBHOOKS.GITHUB]: this._githubAdapter.bind(this)
        };
        this.infoRegister = {
            [WEBHOOKS.GITHUB]: this._githubInfo.bind(this)
        };
    }

    adapt({ type, data }) {
        return this.adapterRegister[type](data);
    }

    getInfoAndAdapt({ payload }) {
        return this.infoRegister[payload.gitRepository.gitKind](payload);
    }

    async _githubInfo(payload) {
        const octokit = new Octokit();
        const { owner, repo } = this._parseGithubUrlRepo(payload.gitRepository.url);
        let lastCommit;
        try {
            lastCommit = await octokit.repos.listCommits({
                owner,
                repo,
                sha: payload.gitRepository.branchName,
                per_page: 1,
                page: 1
            });
        }
        catch (error) {
            log.error(`faild to get commit info for url ${payload.gitRepository.url}- ${error}`, { component: component.GITHUB_WEBHOOK });
        }


        return {
            ...payload,
            gitRepository: this._githubAdapter({
                commits:
                    [{
                        id: lastCommit.data[0].sha,
                        timestamp: lastCommit.data[0].commit.committer.date,
                        message: lastCommit.data[0].commit.message
                    }],
                repository: { url: payload.gitRepository.url, branchName: payload.gitRepository.branchName }
            })

        };
    }

    _githubAdapter({ ref, commits, repository }) {
        const branchName = repository.branchName ? repository.branchName : this._refParse(ref);
        if (!commits || commits.length === 0) {
            log.warning(`commit is not defined for webhook url ${repository.url}`, { component: component.GITHUB_WEBHOOK });
            return null;
            // this._progress(data);
        }
        return this._adapter(commits[0].id, commits[0].timestamp, commits[0].message, branchName, repository.url, WEBHOOKS.GITHUB);
    }

    _refParse(ref) {
        return ref.split('/')[2];
    }

    _adapter(commitId, timestamp, message, branchName, repositoryUrl, webhookType) {
        return {
            commit: { id: commitId, timestamp, message },
            repository: { url: repositoryUrl, branchName },
            webhookType,
            type: BUILD_TYPES.GIT
        };
    }

    _parseGithubUrlRepo(url) {
        const splittedUrl = url.split('/');
        return {
            owner: splittedUrl[3],
            repo: splittedUrl[4]
        };
    }
}

module.exports = new GitDataAdapter();
