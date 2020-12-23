const { buildTypes } = require('@hkube/consts');
const { ResourceNotFoundError } = require('../../errors');
const { WEBHOOKS } = require('../../consts/builds');
const gitDataAdapter = require('./git-data-adapter');
const algorithmService = require('../algorithms');
const stateManager = require('../../state/state-manager');

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
        return Promise.all(algorithms.map(a => this._storeBuildData({
            ...a,
            gitRepository: { ...a.gitRepository, commit: gitDetails.commit },
            algorithmImage: null
        })));
    }

    async _checkRegistration({ url, branchName }) {
        const algorithmList = await stateManager.getAlgorithms();
        return algorithmList.filter(a => a.gitRepository && url === a.gitRepository.webUrl && branchName === a.gitRepository.branchName);
    }

    async _storeBuildData(data) {
        return algorithmService.applyAlgorithm({ payload: { ...data, type: buildTypes.GIT } });
    }
}

module.exports = new GitWebhookListener();
