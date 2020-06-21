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
            [WEBHOOKS.GITHUB]: gitService.getGithubCommit.bind(gitService),
            [WEBHOOKS.GITLAB]: gitService.getGitlabCommit.bind(gitService)
        };
    }

    adapt({ type, data }) {
        return this.adapterRegister[type](data);
    }

    async getInfoAndAdapt(payload) {
        const getGithubCommit = this.infoRegister[payload.gitRepository.gitKind];
        const gitRepository = this._adaptRepoUrl(payload.gitRepository);
        const commit = await getGithubCommit(gitRepository);

        return {
            ...gitRepository,
            commit
        };
    }

    _adaptRepoUrl(gitRepository) {
        const { url } = gitRepository;
        const webUrl = url.endsWith('.git') ? url.slice(0, -4) : url;
        const cloneUrl = !url.endsWith('.git') ? `${url}.git` : url;
        return {
            ...gitRepository,
            webUrl,
            cloneUrl
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
