const { uuid: uuidv4 } = require('@hkube/uid');
const request = require('request-promise');
const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
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
    postSubPipeline(subPipeline, type, subPipelineId) {
        const apiUrl = `${this._apiBaseUrl}${type}`;
        log.info(`send post ${type} request to subPipeline ${subPipeline.jobId}`);
        return this._postRequest(subPipeline, apiUrl, subPipelineId);
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
    async _postRequest(body, apiUrl, subPipelineId) {
        const uuid = uuidv4();
        this.startSpan(uuid, body.jobId, body.taskId, subPipelineId, apiUrl);
        const topWorkerSpan = tracer.topSpan(uuid);
        body.spanId = topWorkerSpan.context();  // eslint-disable-line
        const response = await request({
            method: HTTP_POST,
            uri: apiUrl,
            body,
            json: true
        });
        this.finishSpan(uuid);
        return response;
    }

    startSpan(uuid, jobId, taskId, subPipelineId, apiUrl) {
        const spanOptions = {
            name: 'httpPostRequest',
            id: uuid,
            tags: {
                apiUrl,
                jobId,
                taskId
            }
        };
        const topWorkerSpan = tracer.topSpan(subPipelineId);
        if (topWorkerSpan) {
            spanOptions.parent = topWorkerSpan.context();
        }
        tracer.startSpan(spanOptions);
    }

    finishSpan(uuid) {
        const topWorkerSpan = tracer.topSpan(uuid);
        topWorkerSpan.finish();
    }
}

module.exports = new ApiServerClient();
