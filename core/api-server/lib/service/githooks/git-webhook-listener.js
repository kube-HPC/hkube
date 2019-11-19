const stateManager = require('../../state/state-manager');
const { ResourceNotFoundError } = require('../../errors');
const { WEBHOOKS, BUILD_TYPES } = require('../../consts/builds');
const gitDataAdapter = require('./git-data-adapter');
const algorithmService = require('../algorithms');

class GitWebhookListener {
    async listen(data, type = WEBHOOKS.GITHUB) {
        const gitDetails = gitDataAdapter.adapt({ type, data });
        if (!gitDetails) {
            throw new ResourceNotFoundError('url', '');
        }
        const algorithms = await this._checkRegistration(gitDetails.repository);
        if (!algorithms.length) {
            throw new ResourceNotFoundError('url', gitDetails.repository.url);
        }
        return Promise.all(algorithms.map(a => this._storeBuildData({ ...a, gitRepository: { ...a.gitRepository, commit: gitDetails.commit } })));
    }

    async _checkRegistration({ url, branchName }) {
        const algorithmList = await stateManager.getAlgorithms();
        return algorithmList.filter(a => url === (a.gitRepository && a.gitRepository.webUrl) && branchName === (a.gitRepository && a.gitRepository.branchName));
    }

    async _storeBuildData(data) {
        return algorithmService.applyAlgorithm({ payload: { ...data, type: BUILD_TYPES.GIT } });
    }
}

module.exports = new GitWebhookListener();
