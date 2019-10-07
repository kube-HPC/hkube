// this.adapter = {
//     commit: { id: null, timestamp: null, message: null }
//     repository: { utl: null }
// }
const stateManager = require('../../state/state-manager');
const { ResourceNotFoundError } = require('../../errors');
const { WEBHOOKS, BUILD_TYPES } = require('../../consts/builds');
const gitDataAdapter = require('./git-data-adapter');
const algorithms = require('../algorithms');

class GitWebhookListener {
    async listen(data) {
        const gitDetails = gitDataAdapter.adapt({ type: WEBHOOKS.GITHUB, data });
        if (!gitDetails) {
            throw new ResourceNotFoundError('algorithm', '');
        }
        // { url: `${gitDetails.repository.url}.git`, branchName: gitDetails.repository.branchName }
        const _algorithms = await this._checkRegistration(gitDetails.repository);
        if (!_algorithms.length) {
            throw new ResourceNotFoundError('algorithm', gitDetails.repository.url);
        }
        const res = await Promise.all(_algorithms.map(algorithm => this._storeBuildData(
            {
                ...algorithm,
                mem: algorithm.memReadable,
                gitRepository: { ...algorithm.gitRepository, commit: gitDetails.commit }
            }
        )));
        return res;
    }


    async _checkRegistration({ url, branchName }) {
        // TODO:add branch for filter
        const algorithmList = await stateManager.getAlgorithms();
        const storedAlgorithms = algorithmList.filter(a => url === (a.gitRepository && a.gitRepository.url) && branchName === (a.gitRepository && a.gitRepository.branchName));
        return storedAlgorithms;
    }

    async _storeBuildData(data) {
        return algorithms.applyAlgorithm({ payload: { ...data, type: BUILD_TYPES.GIT } });
    }
}

module.exports = new GitWebhookListener();
