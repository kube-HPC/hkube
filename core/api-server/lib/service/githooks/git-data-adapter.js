const Octokit = require('@octokit/rest');
const Logger = require('@hkube/logger');
const stateManager = require('../../state/state-manager');
const component = require('../../consts/componentNames');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed, InvalidDataError } = require('../../errors');
const { WEBHOOKS, BUILD_TYPES } = require('../../consts/builds');
const algorithms = require('../algorithms');

const log = Logger.GetLogFromContanier();
class gitDataAdapter {
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
                per_page: 1,
                page: 1
            });
        }
        catch (error) {
            console.log(error);
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
                repository: { url: payload.gitRepository.url }
            })

        };
    }

    _githubAdapter({ commits, repository }) {
        if (!commits || commits.length === 0) {
            log.warning(`commit is not defined for webhook url ${repository.url}`, { component: component.GITHUB_WEBHOOK });
            return null;
            // this._progress(data);
        }
        return this._adapter(commits[0].id, commits[0].timestamp, commits[0].message, repository.url, WEBHOOKS.GITHUB);
    }

    _adapter(commitId, timestamp, message, repositoryUrl, webhookType) {
        return {
            commit: { id: commitId, timestamp, message },
            repository: { url: repositoryUrl },
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

module.exports = new gitDataAdapter();
