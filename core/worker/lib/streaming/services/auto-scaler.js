const { parser } = require('@hkube/parsers');
const Logger = require('@hkube/logger');
const { stateType } = require('@hkube/consts');
const stateAdapter = require('../../states/stateAdapter');
const { Statistics, Progress, PendingScale, Metrics } = require('../core');
const producer = require('../../producer/producer');
const discovery = require('./service-discovery');
const { Components } = require('../../consts');
const component = Components.AUTO_SCALER;
let log;

class AutoScaler {
    constructor(options) {
        log = Logger.GetLogFromContainer();
        this._nodeName = options.nodeName;
        this._options = options;
        this._isStateful = options.node.stateType === stateType.Stateful;
        this.clean();
    }

    clean() {
        this._metrics = [];
        this._statsPrint = Object.create(null);
        this._progress = new Progress();
        this._statistics = new Statistics(this._options.config);
        this._pendingScale = new PendingScale(this._options.config);
    }

    report(data) {
        this._statistics.report(data);
    }

    getProgress() {
        return this._progress.data;
    }

    getMetrics() {
        return this._metrics;
    }

    scale() {
        const { scaleUp, scaleDown } = this._createScale();
        this._scaleUp(scaleUp);
        this._scaleDown(scaleDown);
        return { scaleUp, scaleDown };
    }

    _createScale() {
        let scaleUp = null;
        let scaleDown = null;
        const upList = [];
        const downList = [];
        this._metrics = [];
        let currentSize = 0;

        for (const stat of this._statistics) {
            const { source, data } = stat;
            const { nodeName } = data;
            currentSize = data.currentSize || discovery.countInstances(nodeName);
            const { reqRate, resRate, durationsRate, totalRequests, totalResponses } = Metrics.CalcRates(stat.data, this._options.config);
            const metric = { source, target: nodeName, currentSize, reqRate, resRate, durationsRate, totalRequests, totalResponses };
            this._metrics.push(metric);

            const hasRates = reqRate || resRate || durationsRate;
            this._updateProgress(metric);
            this._printRatesStats(metric);

            if (!this._isStateful && hasRates) {
                const result = this._getScaleDetails({ reqRate, resRate, durationsRate, currentSize });
                if (result.up) {
                    upList.push(result.up);
                }
                else if (result.down) {
                    downList.push(result.down);
                }
            }
        }

        const up = Math.ceil(Metrics.Avg(upList));
        const down = Math.ceil(Metrics.Avg(downList));
        this._pendingScale.check(currentSize);

        if (this._canScaleUp(up)) {
            const scaleTo = currentSize + up;
            scaleUp = { replicas: up, currentSize, scaleTo, nodes: upList };
            this._pendingScale.updateUp(scaleTo);
        }
        else if (this._canScaleDown(down)) {
            const scaleTo = currentSize - down;
            this._pendingScale.updateDown(scaleTo);
            scaleDown = { replicas: down, currentSize, scaleTo, nodes: downList };
        }
        return { scaleUp, scaleDown };
    }

    _printRatesStats(metric) {
        if (!this._statsPrint[metric.source] || Date.now() - this._statsPrint[metric.source] >= 30000) {
            const { source, target, currentSize, reqRate, resRate, durationsRate, totalRequests, totalResponses } = metric;
            log.info(`stats for ${source}=>${target}: size: ${currentSize}, req rate=${reqRate.toFixed(2)}, res rate=${resRate.toFixed(2)}, durations rate=${durationsRate.toFixed(2)}, total requests=${totalRequests}, total responses=${totalResponses}`, { component });
            this._statsPrint[metric.source] = Date.now();
        }
    }

    _updateProgress(metric) {
        const { source, reqRate, resRate } = metric;
        if (reqRate && resRate) {
            const progress = parseFloat((resRate / reqRate).toFixed(2));
            this._progress.update(source, progress);
        }
    }

    _getScaleDetails({ reqRate, resRate, durationsRate, currentSize }) {
        let resRates = resRate;
        let durationsRates = durationsRate;
        let hasResRate = true;

        if (!resRates) {
            resRates = reqRate;
            hasResRate = false;
        }
        if (!durationsRates) {
            durationsRates = reqRate;
        }
        const reqResRatio = reqRate / resRates;
        const durationsRatio = reqRate / durationsRate;

        const result = { up: 0, down: 0 };

        if (this._shouldScaleUp({ reqResRatio, hasResRate })) {
            const scaleSize = this._calcSize(currentSize, reqResRatio);
            const replicas = Math.min(scaleSize, this._options.config.maxReplicas);
            result.up = replicas;
        }
        else if (this._shouldScaleDown({ durationsRatio, currentSize })) {
            const scaleSize = this._calcSize(currentSize, durationsRatio);
            const replicas = Math.min(scaleSize, currentSize);
            result.down = replicas;
        }
        return result;
    }

    _calcSize(currentSize, ratio) {
        const size = currentSize || 1;
        return Math.ceil(size * ratio);
    }

    _logScaling({ action, currentSize, scaleTo, nodes }) {
        log.info(`scaling ${action} from ${currentSize} to ${scaleTo} replicas for node ${this._nodeName} based on avg of ${nodes.length} nodes [${nodes}]`, { component });
    }

    _shouldScaleUp({ reqResRatio, hasResRate }) {
        return ((reqResRatio >= this._options.config.minRatioToScaleUp) || (!hasResRate && reqResRatio > 0));
    }

    _shouldScaleDown({ durationsRatio, currentSize }) {
        return currentSize > this._options.config.minReplicasToScaleDown
            && durationsRatio <= this._options.config.minRatioToScaleDown;
    }

    _canScaleUp(count) {
        return count > 0 && !this._pendingScale.hasDesiredUp();
    }

    _canScaleDown(count) {
        return count > 0 && !this._pendingScale.hasDesiredDown();
    }

    _scaleUp(scaleUp) {
        if (!scaleUp) {
            return null;
        }
        this._logScaling({ action: 'up', ...scaleUp });
        const { replicas } = scaleUp;
        const tasks = [];
        const parse = {
            flowInputMetadata: this._options.pipeline.flowInputMetadata,
            nodeInput: this._options.node.input,
            ignoreParentResult: true
        };
        const result = parser.parse(parse);
        for (let i = 0; i < replicas; i += 1) {
            const taskId = producer.createTaskID();
            const task = { taskId, input: result.input, storage: result.storage, batchIndex: i + 1 };
            tasks.push(task);
        }
        const job = {
            ...this._options.jobData,
            ...this._options.node,
            tasks,
            isScaled: true
        };
        return producer.createJob({ jobData: job });
    }

    _scaleDown(scaleDown) {
        if (!scaleDown) {
            return null;
        }
        this._logScaling({ action: 'down', ...scaleDown });
        const { nodeName, replicas } = scaleDown;
        const instances = discovery.getInstances(nodeName);
        const workers = instances.slice(0, replicas);
        return Promise.all(workers.map(w => stateAdapter.stopWorker(w.workerId)));
    }
}

module.exports = AutoScaler;
