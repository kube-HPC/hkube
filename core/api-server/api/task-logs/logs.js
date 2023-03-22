const fs = require('fs');
const log = require('@hkube/logger').GetLogFromContainer();
const orderBy = require('lodash.orderby');
const { logModes, podStatus } = require('@hkube/consts');
const elasticSearch = require('./es');
const kubernetes = require('./kubernetes');
const component = require('../../lib/consts/componentNames').LOGS;
const { sources, formats, containers, sortOrder, LOGS_LIMIT } = require('./consts');
class Logs {
    constructor() {
        this._sources = new Map();
        this._sources.set(sources.k8s, kubernetes);
        this._sources.set(sources.es, elasticSearch);
    }

    async init(options) {
        if (!options.serviceAccount.token) {
            const { tokenPath } = options.serviceAccount;
            if (fs.existsSync(tokenPath)) {
                const buffer = fs.readFileSync(tokenPath);
                // eslint-disable-next-line no-param-reassign
                options.token = buffer.toString();
            }
        }
        elasticSearch.init(options);
        await kubernetes.init(options);
        this.updateSource(options.logsView.source);
        this.updateFormat(options.logsView.format);
    }

    get settings() {
        return {
            currentSource: this._logsSource,
            availableSources: Object.keys(sources)
        };
    }

    updateSource(source) {
        if (Object.keys(sources).includes(source)) {
            this._logsSource = source;
        }
    }

    updateFormat(format) {
        if (Object.keys(formats).includes(format)) {
            kubernetes.updateFormat(format);
        }
    }

    _getLogSource(source) {
        if (Object.keys(sources).includes(source)) {
            return this._sources.get(source);
        }
        throw new Error(`Unknown log source ${source}`);
    }

    async getLogs({
        taskId,
        podName,
        nodeKind = containers.worker,
        source = sources.k8s,
        logMode = logModes.ALGORITHM,
        pageNum = 0,
        sort = sortOrder.desc,
        limit = LOGS_LIMIT,
        searchWord,
        taskTime
    }) {
        let logs = [];
        const logsData = {};
        try {
            let skip = 0;
            const pageNumber = parseInt(pageNum, 10);
            const sizeLimit = parseInt(limit, 10);
            if (pageNumber > 0) {
                skip = (pageNumber - 1) * sizeLimit;
            }

            logsData.podStatus = podStatus.NORMAL;

            try {
                const podData = await kubernetes._client.pods.get({ podName });
                const currentAlgorunner = podData.body.status.containerStatuses.filter(x => x.name === containers.algorunner)[0];
                const { terminated, waiting } = currentAlgorunner.state;

                if (terminated?.reason === 'Error') {
                    logsData.podStatus = podStatus.ERROR;
                }
                else if (waiting?.reason === 'ImagePullBackOff') {
                    logsData.podStatus = podStatus.NO_IMAGE;
                }
            }
            catch (e) {
                logsData.podStatus = podStatus.NOT_EXIST;
            }

            if (source === sources.k8s && logsData.podStatus === podStatus.NOT_EXIST) {
                logsData.logs = [];
            }
            else {
                const logSource = this._getLogSource(source);
                logs = await logSource.getLogs({
                    taskId,
                    podName,
                    nodeKind,
                    logMode,
                    sort,
                    skip,
                    ageNum: pageNumber,
                    limit: sizeLimit,
                    searchWord,
                    taskTime
                });
                logs = logs.map(this._format);
                logs = orderBy(logs, l => l.timestamp, sortOrder.desc);
                logsData.logs = logs;
            }
        }
        catch (e) {
            const error = `cannot read logs from ${source}, err: ${e.message}`;
            log.warning(error, { component });
            logsData.logs = [{
                message: error
            }];
        }
        return logsData;
    }

    _format(line) {
        return {
            timestamp: line.meta?.timestamp,
            level: line.level,
            message: line.message
        };
    }
}

module.exports = new Logs();
