// this.adapter = {
//     commit: { id: null, timestamp: null, message: null }
//     repository: { utl: null }
// }
const Logger = require('@hkube/logger');
const stateManager = require('../../state/state-manager');
const component = require('../../consts/componentNames');
const { ResourceNotFoundError, ResourceExistsError, ActionNotAllowed, InvalidDataError } = require('../../errors');
const { WEBHOOKS, BUILD_TYPES } = require('../../consts/builds');
const gitDataAdapter = require('./git-data-adapter');
const algorithms = require('../algorithms');

const log = Logger.GetLogFromContanier();
class gitWebhookListener {
    async listen(data) {
        const gitDetails = gitDataAdapter.adapt({ type: WEBHOOKS.GITHUB, data });
        if (!gitDetails) {
            throw new ResourceNotFoundError('algorithm', '');
        }
        const _algorithms = await this._checkRegistration(gitDetails.repository.url);
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


    async _checkRegistration(url) {
        // TODO:add branch for filter
        const algorithmList = await stateManager.getAlgorithms();
        const _algorithms = algorithmList.filter(a => url === (a.gitRepository && a.gitRepository.url));

        return _algorithms;
    }

    async _storeBuildData(data) {
        return algorithms.applyAlgorithm({ payload: { ...data, type: BUILD_TYPES.GIT } });
    }
}

module.exports = new gitWebhookListener();
