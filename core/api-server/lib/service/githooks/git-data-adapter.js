const Logger = require('@hkube/logger');
const gitService = require('./git-service');
const component = require('../../consts/componentNames');
const { WEBHOOKS } = require('../../consts/builds');
const log = Logger.GetLogFromContanier();
class GitDataAdapter {
    constructor() {
        this.adapterRegister = {
            [WEBHOOKS.GITHUB]: this._githubAdapter.bind(this),
            [WEBHOOKS.GITLAB]: this._gitlabAdapter.bind(this)
        };
        this.infoRegister = {
            [WEBHOOKS.GITHUB]: this._githubInfo.bind(this),
            [WEBHOOKS.GITLAB]: this._gitlabInfo.bind(this)
        };
    }

    adapt({ type, data }) {
        return this.adapterRegister[type](data);
    }

    getInfoAndAdapt(payload) {
        return this.infoRegister[payload.gitRepository.gitKind](payload);
    }

    async _githubInfo(payload) {
        const gitRepository = this._adaptRepoUrl(payload.gitRepository);
        const { webUrl, commitId, branchName, token } = gitRepository;
        const commit = await gitService.getGithubCommit({ url: webUrl, commitId, branchName, token });

        return {
            ...payload,
            gitRepository: {
                ...payload.gitRepository,
                ...gitRepository,
                commit
            }
        };
    }

    async _gitlabInfo(payload) {
        const gitRepository = this._adaptRepoUrl(payload.gitRepository);
        const { webUrl, commitId, branchName, token } = gitRepository;
        const commit = await gitService.getGitlabCommit({ url: webUrl, commitId, branchName, token });

        return {
            ...payload,
            gitRepository: {
                ...payload.gitRepository,
                ...gitRepository,
                commit
            }
        };
    }

    _adaptRepoUrl(gitRepository) {
        const { url, commit, branchName, token } = gitRepository;
        const webUrl = url.endsWith('.git') ? url.slice(0, -4) : url;
        const cloneUrl = !url.endsWith('.git') ? `${url}.git` : url;
        return {
            branchName,
            commitId: commit && commit.id,
            token,
            webUrl,
            cloneUrl,
            url
        };
    }

    _gitAdapter({ ref, commits, repository, type = WEBHOOKS.GITHUB }) {
        const branchName = repository.branchName ? repository.branchName : this._refParse(ref);
        if (!commits || commits.length === 0) {
            log.warning(`commit is not defined for webhook url ${repository.url}`, { component: component.GITHUB_WEBHOOK });
            return null;
        }
        const commit = commits[0];
        return this._adapter(commit, repository, branchName, type);
    }

    _githubAdapter({ ref, commits, repository, type = WEBHOOKS.GITHUB }) {
        return this._gitAdapter({ ref, commits, repository, type });
    }

    _gitlabAdapter({ ref, commits, repository, type = WEBHOOKS.GITLAB }) {
        return this._gitAdapter({ ref, commits, repository: { url: repository.homepage }, type });
    }

    _refParse(ref) {
        return ref.split('/')[2];
    }

    _adapter(commit, gitRepository, branchName, webhookType) {
        const { url, webUrl, cloneUrl, token } = gitRepository;
        const repository = { url, webUrl, cloneUrl, branchName, token };

        return {
            commit,
            repository,
            webhookType
        };
    }
}

module.exports = new GitDataAdapter();
