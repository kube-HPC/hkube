const request = require('request-promise');
const Logger = require('@hkube/logger');
const { ApiServerPostTypes } = require('../consts');

let log;
const HTTP_POST = 'POST';

class ApiServerClient {
    async init(options = {}) {
        log = Logger.GetLogFromContainer();
        this._options = options;
        const {
            protocol, host, port, basePath
        } = options.apiServer;
        this._apiBaseUrl = `${protocol}://${host}:${port}/${basePath}`;
    }

    /**
     * Post SubPipeline (raw or stored) as a pipeline in ApiServer
     * @param {object} subPipeline
     * @param {string} type RAW or STORED from const/postSubPipelineType.js
     */
    postSubPipeline(subPipeline, type) {
        const apiUrl = `${this._apiBaseUrl}${type}`;
        log.info(`send post ${type} request to subPipeline ${subPipeline.jobId}`);
        return this._postRequest(subPipeline, apiUrl);
    }

    /**
     * Post stop request for subpipeline jobId in ApiServer
     * @param {string} jobId
     * @param {string} reason
     */
    postStopSubPipeline(jobId, reason) {
        log.info(`send stop request to subPipeline ${jobId}`);
        const body = { jobId, reason };
        const apiUrl = `${this._apiBaseUrl}${ApiServerPostTypes.STOP}`;
        return this._postRequest(body, apiUrl);
    }

    /**
     * Send a post request to ApiServer
     * @param {object} body
     * @param {string} apiUrl
     * @throws {object} error
     */
    async _postRequest(body, apiUrl) {
        const response = await request({
            method: HTTP_POST,
            uri: apiUrl,
            body,
            json: true
        });
        return response;
    }
}

module.exports = new ApiServerClient();
