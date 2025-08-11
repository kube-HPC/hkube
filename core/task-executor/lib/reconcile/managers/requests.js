const { stateType } = require('@hkube/consts');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { normalizeHotRequestsByType, normalizeRequests } = require('../normalize');
const component = 'RequestsManager';

class RequestsManager {
    constructor() {
        this.totalCapacityNow = 10;
        this.windowSizeFactor = 3;
        this.maxFilteredRequests = {};
        this.finalRequests = {};
    }

    prepareAlgorithmRequests(algorithmRequests, algorithmTemplates, jobAttachedWorkers, workerCategories) {
        const normRequests = normalizeRequests(algorithmRequests, algorithmTemplates);

        // leave only requests that are not exceeding max workers.
        this.maxFilteredRequests = this._handleMaxWorkers(algorithmTemplates, normRequests, jobAttachedWorkers);
        // Categorize requests into batch and streaming.
        const categorizedRequests = this._categorizeRequests(this.maxFilteredRequests);
        // Get list of requests that are quotaGuaranteed, meaning should be handled first.
        const { batchRequisiteRequests, streamingRequisiteRequests } = this._makeRequisiteRequests(categorizedRequests, algorithmTemplates, workerCategories);
        // In order to handle batch requests gradually, create a window list (also sort by prioritization of quotaGuarantee).
        const batchRequestWindow = this._createBatchRequestsWindow(batchRequisiteRequests);
        // Add requests for hot workers as well
        const { hotBatchRequests, hotStreamingRequests } = this._handleHotRequests(batchRequestWindow, streamingRequisiteRequests, algorithmTemplates);
        // log.info(`capacity = ${totalCapacityNow}, totalRequests = ${totalRequests.length} `);
        const requestTypes = this._calcRatio(hotBatchRequests, this.totalCapacityNow);
        // const workerTypes = calcRatio(jobAttachedWorkers);
        // log.info(`worker = ${JSON.stringify(Object.entries(workerTypes.algorithms).map(([k, v]) => ({ name: k, ratio: v.ratio })), null, 2)}`);
        // log.info(`requests = ${JSON.stringify(Object.entries(requestTypes.algorithms).map(([k, v]) => ({ name: k, count: v.count, req: v.required })), null, 2)}`);'
        const cutRequests = this._cutRequests(hotBatchRequests, requestTypes);
        this.finalRequests = this._createFinalRequestsList(cutRequests, hotStreamingRequests);
    }

    updateCapacity(algorithmCount) {
        const factor = 0.9;
        const minCapacity = 2;
        const maxCapacity = 50;
        this.totalCapacityNow = this.totalCapacityNow * factor + algorithmCount * (1 - factor);
        if (this.totalCapacityNow < minCapacity) {
            this.totalCapacityNow = minCapacity;
        }
        if (this.totalCapacityNow > maxCapacity) {
            this.totalCapacityNow = maxCapacity;
        }
    }

    _handleMaxWorkers(algorithmTemplates, normRequests, workers) {
        const workersPerAlgorithm = workers.reduce((prev, cur) => {
            const { algorithmName } = cur;
            prev[algorithmName] = prev[algorithmName] ? prev[algorithmName] + 1 : 1;
            return prev;
        }, {});

        const filtered = normRequests.filter(r => {
            const maxWorkers = algorithmTemplates[r.algorithmName]?.maxWorkers;
            if (!maxWorkers) {
                return true;
            }

            if ((workersPerAlgorithm[r.algorithmName] || 0) < maxWorkers) {
                workersPerAlgorithm[r.algorithmName] = workersPerAlgorithm[r.algorithmName] ? workersPerAlgorithm[r.algorithmName] + 1 : 1;
                return true;
            }

            return false;
        });
        return filtered;
    }

    _categorizeRequests(requests) {
        const batchRequests = [];
        const streamingRequests = [];
        let batchCount = 0;
        let streamingCount = 0;
        requests.forEach(request => {
            const shouldSkipWindow = request.requestType === stateType.Stateful || request.requestType === stateType.Stateless;
            if (shouldSkipWindow) {
                if (request.requestType === stateType.Stateful) {
                    streamingRequests.unshift(request);
                }
                else {
                    streamingRequests.push(request);
                }
                streamingCount += 1;
            }
            else {
                batchRequests.push(request);
                batchCount += 1;
            }
        });
        log.trace(`Categorized requests: ${batchCount} batch, ${streamingCount} streaming`, { component });
        return { batchRequests, streamingRequests };
    }

    _makeRequisiteRequests(categorizedRequests, algorithmTemplates, workerCategories) {
        // Get list of requests that are quotaGuaranteed, meaning should be handled first.
        const { batchRequests, streamingRequests } = categorizedRequests;
        const batchRequisiteRequests = this._createRequisite(batchRequests, algorithmTemplates, workerCategories);
        const streamingRequisiteRequests = this._createRequisite(streamingRequests, algorithmTemplates, workerCategories);
        return { batchRequisiteRequests, streamingRequisiteRequests };
    }

    /**
     * This method does mainly this thing:
     *    Prioritizing algorithms that have `quotaGuarantee`.
     * The algorithm is as follows:
     *    If there is any algorithm with `quotaGuarantee`.
     *      a. Iterate all requests.
     *      b. If encountered an algorithm with `quotaGuarantee` that didn't handle.
     *         b1. Mark the algorithm as visited.
     *         b2. Calculate missing algorithms by `quotaGuarantee - running`.
     *         b3. If there are a missing algorithms, move these algorithms to the top of our window (start of request array).
     *         b4. Save the indices of these algorithms to ignore them next iteration.
     *         b5. If there are no missing algorithms, just add it to the window.
     *      c. If already moved this algorithm to the top, ignore it, else add it to the window.
     */
    _createRequisite(normRequests, algorithmTemplates, workerCategories) {
        const { idleWorkers, activeWorkers, pausedWorkers, pendingWorkers } = workerCategories;
        const hasRequisiteAlgorithms = normRequests.some(r => algorithmTemplates[r.algorithmName]?.quotaGuarantee);
        let currentRequests = normRequests;

        if (hasRequisiteAlgorithms) {
            const { requests, requisites } = this._createRequisitesRequests(normRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers);
            currentRequests = this._mergeRequisiteRequests(requests, requisites);
        }
        return currentRequests;
    }

    _createRequisitesRequests(normRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers) {
        const requests = [];
        const visited = {};
        const indices = {};
        const requisites = { algorithms: {}, totalRequired: 0 };
        const runningWorkersList = [...idleWorkers, ...activeWorkers, ...pausedWorkers, ...pendingWorkers];
        const runningWorkersMap = this._workersToMap(runningWorkersList);

        normRequests.forEach((r, i) => {
            const { algorithmName } = r;
            const quotaGuarantee = algorithmTemplates[algorithmName]?.quotaGuarantee;
            if (quotaGuarantee && !visited[algorithmName]) {
                visited[algorithmName] = true;
                const running = runningWorkersMap[algorithmName] || 0;
                const diff = quotaGuarantee - running;
                if (diff > 0) {
                    const required = normRequests
                        .map((a, j) => ({ index: j, alg: a }))
                        .filter(n => n.alg.algorithmName === algorithmName)
                        .slice(0, diff);
                    requisites.algorithms[algorithmName] = requisites.algorithms[algorithmName] || {};
                    requisites.algorithms[algorithmName].required = required.map(a => a.alg);
                    requisites.totalRequired += required.length;
                    required.forEach((alg) => {
                        indices[alg.index] = true; // save the indices so we will ignore them next iteration.
                    });
                }
                else {
                    requests.push(r);
                }
            }
            else if (!indices[i]) {
                requests.push(r);
            }
        });
        return { requests, requisites };
    }

    _workersToMap(requests) {
        return requests.reduce((prev, cur) => {
            if (!prev[cur.algorithmName]) {
                prev[cur.algorithmName] = 0;
            }
            prev[cur.algorithmName] += 1;
            return prev;
        }, {});
    }

    _mergeRequisiteRequests(requests, requisites) {
        /**
        *
        * requisites:
        *     alg  | count | req  | diff
        *   green  |  800  |  80  |  10
        *   yellow |  200  |  20  |  8
        *   black  |  100  |  10  |  5
        *   total  |  1100 |  110 |  23
        * 
        * ratios:
        *   green:  (10 / 23) * 10 = ~4
        *   yellow: (08 / 23) * 8  = ~3
        *   black:  (05 / 23) * 5  = ~1
        *   [g,g,g,g,y,y,y,b]
        *
        */

        const ratioSum = requisites.totalRequired;

        while (requisites.totalRequired > 0) {
            Object.values(requisites.algorithms).forEach((v) => {
                const ratio = (v.required.length / ratioSum);
                const required = Math.round(v.required.length * ratio) || 1;
                const diff = requisites.totalRequired - required;
                const total = diff < 0 ? requisites.totalRequired : required;
                const arr = v.required.slice(0, total);
                arr.forEach(r => { // Mark requisite requests
                    r.isRequisite = true;
                });

                requisites.totalRequired -= arr.length;
                requests.unshift(...arr);
            });
        }
        return requests;
    }

    /**
     * This method is creating a subset (window) from the given batch requests.
     */
    _createBatchRequestsWindow(currentRequests) {
        const windowSize = Math.round(this.totalCapacityNow * this.windowSizeFactor);
        const requestsWindow = currentRequests.slice(0, windowSize);
        return requestsWindow;
    }

    _handleHotRequests(batchRequests, streamingRequests, algorithmTemplateStore) {
        const hotBatchRequests = normalizeHotRequestsByType(batchRequests, algorithmTemplateStore);
        const hotStreamingRequests = normalizeHotRequestsByType(streamingRequests, algorithmTemplateStore, [stateType.Stateful, stateType.Stateless]);
        return { hotBatchRequests, hotStreamingRequests };
    }

    _calcRatio(totalRequests, capacity) {
        const requestTypes = totalRequests.reduce((prev, cur) => {
            if (!prev.algorithms[cur.algorithmName]) {
                prev.algorithms[cur.algorithmName] = {
                    count: 0,
                    list: []
                };
            }
            prev.algorithms[cur.algorithmName].count += 1;
            prev.algorithms[cur.algorithmName].list.push(cur);
            prev.total += 1;
            return prev;
        }, { total: 0, algorithms: {} });
        Object.keys(requestTypes.algorithms).forEach(k => {
            if (capacity) {
                const ratio = requestTypes.algorithms[k].count / requestTypes.total;
                const required = ratio * capacity;
                requestTypes.algorithms[k].ratio = ratio;
                requestTypes.algorithms[k].required = required;
            }
        });
        return requestTypes;
    }

    _cutRequests(totalRequests, requestTypes) {
        const cutRequests = [];
        totalRequests.forEach(r => {
            const ratios = this._calcRatio(cutRequests);
            const { required } = requestTypes.algorithms[r.algorithmName];
            const algorithm = ratios.algorithms[r.algorithmName];
            if (!algorithm || algorithm.count < required) {
                cutRequests.push(r);
            }
        });
        return cutRequests;
    }

    /**
     * Creates a combined list of requests in the following order:
     * 1. Requisite requests (from both streaming and batch).
     * 2. Remaining streaming requests.
     * 3. Remaining batch requests.
     *
     * @param {Array} batchRequests - List of batch-type requests.
     * @param {Array} streamingRequests - List of streaming-type requests.
     * @returns {Array} Combined and ordered list of all requests.
     */
    _createFinalRequestsList(batchRequests, streamingRequests) {
        const isRequisite = req => req.isRequisite;

        const requisites = [...streamingRequests, ...batchRequests].filter(isRequisite);
        const streaming = streamingRequests.filter(req => !isRequisite(req));
        const batch = batchRequests.filter(req => !isRequisite(req));

        return [...requisites, ...streaming, ...batch];
    }
}

module.exports = new RequestsManager();
