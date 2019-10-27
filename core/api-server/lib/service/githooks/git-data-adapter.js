const Octokit = require('@octokit/rest');
const Logger = require('@hkube/logger');
const component = require('../../consts/componentNames');
const { WEBHOOKS, BUILD_TYPES } = require('../../consts/builds');
const { InvalidDataError } = require('../../errors');
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

    getInfoAndAdapt(payload) {
        return this.infoRegister[payload.gitRepository.gitKind](payload);
    }

    async _githubInfo(payload) {
        const { url, branchName } = payload.gitRepository;
        const lastCommit = await this._getLastCommit({ url, branchName });

        return {
            ...payload,
            gitRepository: this._githubAdapter({
                repository: { url, branchName },
                commits: [{
                    id: lastCommit.sha,
                    timestamp: lastCommit.commit.committer.date,
                    message: lastCommit.commit.message
                }]
            })
        };
    }

    async _getLastCommit({ url, branchName }) {
        const octokit = new Octokit();
        const { owner, repo } = this._parseGithubUrlRepo(url);
        let lastCommit;
        const params = {
            owner,
            repo,
            sha: branchName,
            per_page: 1,
            page: 1
        };
        try {
            lastCommit = await octokit.repos.listCommits(params);
        }
        catch (error) {
            log.error(`failed to get commit info for url ${url} - ${error.message}`, { component: component.GITHUB_WEBHOOK });
            throw new InvalidDataError(`${error.message} (${url})`);
        }
        return lastCommit.data[0];
    }

    _githubAdapter({ ref, commits, repository }) {
        const branchName = repository.branchName ? repository.branchName : this._refParse(ref);
        if (!commits || commits.length === 0) {
            log.warning(`commit is not defined for webhook url ${repository.url}`, { component: component.GITHUB_WEBHOOK });
            return null;
        }
        const commit = commits[0];
        return this._adapter(commit.id, commit.timestamp, commit.message, branchName, repository.url, WEBHOOKS.GITHUB);
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
        const [, , , owner, repo] = url.split('/');
        if (!owner || !repo) {
            throw new InvalidDataError(`invalid url '${url}'`);
        }
        return {
            owner,
            repo: repo.split('.')[0]
        };
    }
}

module.exports = new GitDataAdapter();
