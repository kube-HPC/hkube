const { stateType } = require('@hkube/consts');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { normalizeHotRequestsByType, normalizeRequests } = require('../normalize');
const component = 'RequestsManager';

/**
 * Manages scheduling and prioritization of algorithm execution requests.
 */
class RequestsManager {
    constructor() {
        // Current scheduling capacity
        this.totalCapacityNow = 10;

        // Factor for calculating the request window size
        this.windowSizeFactor = 3;

        // Requests after filtering by max worker limits
        this.maxFilteredRequests = [];
        
        // Final ordered list of requests for execution
        this.finalRequests = [];
    }

    /**
     * Prepares and prioritizes algorithm requests for scheduling.
     *
     * Pipeline steps:
     * 1. Normalize raw algorithm requests into a consistent structure.
     * 2. Filter out requests for algorithms that have reached `maxWorkers`.
     * 3. Split requests into batch and streaming types.
     * 4. Prioritize quota-guaranteed algorithms (requisite requests).
     * 5. Create a batch window based on available capacity.
     * 6. Include hot worker requests.
     * 7. Calculate per-algorithm ratios and required request counts (for batch).
     * 8. Trim requests to match capacity per algorithm (for batch).
     * 9. Merge streaming and batch into a final ordered list.
     *
     * @param {Object[]} algorithmRequests - Incoming raw algorithm requests from etcd.
     * @param {Object} algorithmTemplates - Algorithm definitions from DB.
     * @param {Object[]} jobAttachedWorkers - Workers with their assigned jobs.
     * @param {Object} workerCategories - Categorized workers (idle, active, paused, pending, bootstrap).
     */
    prepareAlgorithmRequests(algorithmRequests, algorithmTemplates, jobAttachedWorkers, workerCategories) {
        // 1. Normalize incoming requests
        const normalizedRequests = normalizeRequests(algorithmRequests, algorithmTemplates);

        // 2. Filter out requests exceeding maxWorkers limit
        this.maxFilteredRequests = this._filterByMaxWorkers(algorithmTemplates, normalizedRequests, jobAttachedWorkers);

        // 3. Categorize into batch and streaming
        const categorizedRequests = this._splitByType(this.maxFilteredRequests);

        // 4. Move quota-guaranteed requests to the front
        const { batchRequisiteRequests, streamingRequisiteRequests } = this._prioritizeQuotaGuaranteeRequests(categorizedRequests, algorithmTemplates, workerCategories);
        
        // 5. Create a limited batch window in order to handle batch requests gradually.
        const batchRequestWindow = this._createBatchWindow(batchRequisiteRequests);

        // 6. Add hot worker requests
        const { hotBatchRequests, hotStreamingRequests } = this._addHotRequests(batchRequestWindow, streamingRequisiteRequests, algorithmTemplates);
        
        // 7. Calculate per-algorithm request ratios
        const requestTypes = this._calculateRequestRatios(hotBatchRequests, this.totalCapacityNow);

        // 8. Trim requests to required per-algorithm count
        const limitedBatchRequests = this._limitRequestsByCapacity(hotBatchRequests, requestTypes);

        // 9. Merge requisites, streaming, and batch into final list
        this.finalRequests = this._mergeFinalRequests(limitedBatchRequests, hotStreamingRequests);
    }

    /**
     * Updates the total capacity based on currently running algorithms.
     * @param {number} algorithmCount - Number of currently running algorithm workers.
     */
    updateCapacity(algorithmCount) {
        const factor = 0.9;
        const minCapacity = 2;
        const maxCapacity = 50;
        this.totalCapacityNow = this.totalCapacityNow * factor + algorithmCount * (1 - factor);
        this.totalCapacityNow = Math.max(minCapacity, Math.min(maxCapacity, this.totalCapacityNow));
    }

    /**
     * Filters out requests that exceed the max worker limit for each algorithm.
     * @private
     * @param {Object} algorithmTemplates
     * @param {Object[]} normalizedRequests
     * @param {Object[]} workers
     * @returns {Object[]} Filtered requests
     */
    _filterByMaxWorkers(algorithmTemplates, normalizedRequests, workers) {
        const workersPerAlgorithm = workers.reduce((acc, worker) => {
            const { algorithmName } = worker;
            acc[algorithmName] = (acc[worker.algorithmName] || 0) + 1;
            return acc;
        }, {});

        const filtered = normalizedRequests.filter(request => {
            const maxWorkers = algorithmTemplates[request.algorithmName]?.maxWorkers;
            if (!maxWorkers) return true;

            if ((workersPerAlgorithm[request.algorithmName] || 0) < maxWorkers) {
                workersPerAlgorithm[request.algorithmName] = (workersPerAlgorithm[request.algorithmName] || 0) + 1;
                return true;
            }
            return false;
        });
        return filtered;
    }

    /**
     * Splits a list of requests into batch and streaming categories.
     * Streaming requests include both Stateful and Stateless types.
     * Stateful requests are placed at the front of the streaming list.
     *
     * @private
     * @param {Object[]} requests - Array of normalized request objects.
     * @returns {{ batchRequests: Object[], streamingRequests: Object[] }}
     *          An object containing separate arrays for batch and streaming requests.
     */
    _splitByType(requests) {
        const batchRequests = [];
        const streamingRequests = [];

        requests.forEach(request => {
            const isStreaming = request.requestType === stateType.Stateful || request.requestType === stateType.Stateless; // Skips window
            if (isStreaming) {
                if (request.requestType === stateType.Stateful) {
                    streamingRequests.unshift(request); // Stateful at front
                }
                else {
                    streamingRequests.push(request);
                }
            }
            else {
                batchRequests.push(request);
            }
        });
        log.trace(`Categorized requests: ${batchRequests.length} batch, ${streamingRequests.length} streaming`, { component });
        return { batchRequests, streamingRequests };
    }

    /**
     * Applies quota guarantee prioritization to categorized requests.
     * Quota-guaranteed requests are handled first for both batch and streaming categories.
     *
     * @private
     * @param {{ batchRequests: Object[], streamingRequests: Object[] }} categorizedRequests - Requests split into batch and streaming.
     * @param {Object} algorithmTemplates - Map of algorithmName -> algorithm template.
     * @param {Object} workerCategories - Categorized workers (idle, active, paused, pending, bootstrap).
     * @returns {{ batchRequisiteRequests: Object[], streamingRequisiteRequests: Object[] }}
     *          Requests with quota-guaranteed items prioritized in each category.
     */
    _prioritizeQuotaGuaranteeRequests(categorizedRequests, algorithmTemplates, workerCategories) {
        const { batchRequests, streamingRequests } = categorizedRequests;
        const batchRequisiteRequests = this._prioritizeQuotaRequisite(batchRequests, algorithmTemplates, workerCategories);
        const streamingRequisiteRequests = this._prioritizeQuotaRequisite(streamingRequests, algorithmTemplates, workerCategories);
        return { batchRequisiteRequests, streamingRequisiteRequests };
    }

    /**
     * Prioritize requests for algorithms that have `quotaGuarantee`.
     *
     * Behaviour:
     *  - If no algorithm in the incoming requests has `quotaGuarantee`, returns the input unchanged.
     *  - Otherwise it builds two structures:
     *      1. `requests` - the input requests with indices that should be processed normally (excludes those reserved by requisites)
     *      2. `requisites` - an object describing per-algorithm lists of required requests that must be handled first
     *    Then merges them back into a prioritized request list via _mergeRequisiteRequests.
     *
     * @private
     * @param {Array<Object>} normalizedRequests - Array of normalized requests (each has algorithmName).
     * @param {Object} algorithmTemplates - Map of algorithmName -> algorithm template (may contain quotaGuarantee).
     * @param {Object} workerCategories - Categorized workers with keys: idleWorkers, activeWorkers, pausedWorkers, pendingWorkers.
     * @returns {Array<Object>} Prioritized requests (array ordered with requisites first).
     */
    _prioritizeQuotaRequisite(normRequests, algorithmTemplates, workerCategories) {
        const { idleWorkers, activeWorkers, pausedWorkers, pendingWorkers } = workerCategories;
        const hasRequisiteAlgorithms = normRequests.some(r => algorithmTemplates[r.algorithmName]?.quotaGuarantee);
        let currentRequests = normRequests;

        if (hasRequisiteAlgorithms) {
            const { requests, requisites } = this._createRequisitesRequests(normRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers);
            currentRequests = this._mergeRequisiteRequests(requests, requisites);
        }
        return currentRequests;
    }

    /**
     * Create the requisites structure and a requests list without the reserved indices.
     *
     * For each algorithm that has `quotaGuarantee`:
     *  - determine how many are currently running (using the runningWorkersList)
     *  - compute diff = quotaGuarantee - running
     *  - if diff > 0, take up to `diff` occurrences of that algorithm from the requests array
     *    and mark them as `requisites.algorithms[algorithmName].required`
     *  - indices of chosen requests are saved so those requests are not included in the 'requests' output
     *
     * @private
     * @param {Array<Object>} normalizedRequests - Array of normalized requests (each has algorithmName).
     * @param {Object} algorithmTemplates - Map of algorithmName -> algorithm template (may contain quotaGuarantee).
     * @param {Array<Object>} idleWorkers - Idle workers list.
     * @param {Array<Object>} activeWorkers - Active workers list.
     * @param {Array<Object>} pausedWorkers - Paused workers list.
     * @param {Array<Object>} pendingWorkers - Pending workers list (jobs with no worker).
     * @returns {{requests: Array<Object>, requisites: Object}} 
     *          - requests: the requests array excluding those reserved for requisites
     *          - requisites: object { algorithms: { <alg>: { required: [requests...] } }, totalRequired: number }
     */
    _createRequisitesRequests(normalizedRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers) {
        const requests = [];
        const visited = {};
        const indicesToIgnore = {};
        const requisites = { algorithms: {}, totalRequired: 0 };

        // combine the running workers into a single list to count running per algorithm
        const runningWorkersList = [...idleWorkers, ...activeWorkers, ...pausedWorkers, ...pendingWorkers];
        const runningWorkersMap = this._workersToMap(runningWorkersList);

        normalizedRequests.forEach((request, idx) => {
            const { algorithmName } = request;
            const quotaGuarantee = algorithmTemplates[algorithmName]?.quotaGuarantee;

            if (quotaGuarantee && !visited[algorithmName]) {
                visited[algorithmName] = true;
                const runningCount = runningWorkersMap[algorithmName] || 0;
                const missing = quotaGuarantee - runningCount;

                if (missing > 0) {
                    // pick up to `missing` requests for this algorithm from the full normalizedRequests array
                    const required = normalizedRequests
                        .map((r, j) => ({ index: j, alg: r }))
                        .filter(x => x.alg.algorithmName === algorithmName)
                        .slice(0, missing);
                    
                    requisites.algorithms[algorithmName] = requisites.algorithms[algorithmName] || {};
                    requisites.algorithms[algorithmName].required = required.map(x => x.alg);
                    requisites.totalRequired += required.length;

                    // mark indices to ignore so they won't be added to the normal 'requests' list next iteration.
                    required.forEach((alg) => {
                        indicesToIgnore[alg.index] = true;
                    });
                }
                else {
                    // no need to reserve requests for this algorithm, treat current one as normal
                    requests.push(request);
                }
            }
            else if (!indicesToIgnore[idx]) {
                // not a reserved index -> include in normal requests
                requests.push(request);
            }
        });

        return { requests, requisites };
    }

    /**
     * Convert an array of workers into a count map.
     *
     * Example output:
     *   { algoA: 3, algoB: 1 }
     *
     * @private
     * @param {Array<Object>} workers - Array of workers.
     * @returns {Object} Map of algorithmName -> count
     */
    _workersToMap(workers) {
        return workers.reduce((acc, worker) => {
            if (!acc[worker.algorithmName]) {
                acc[worker.algorithmName] = 0;
            }
            acc[worker.algorithmName] += 1;
            return acc;
        }, {});
    }

    /**
     * Merge requisites back into the requests list, distributing reserved requisite requests across the final list.
     *
     * Algorithm (preserves your original logic):
     *  - while requisites.totalRequired > 0:
     *      - for each algorithm in requisites.algorithms:
     *          - ratio = v.required.length / ratioSum
     *          - required = Math.round(v.required.length * ratio) || 1
     *          - total = diff < 0 ? requisites.totalRequired : required
     *          - arr = v.required.slice(0, total)
     *          - mark each element in arr with isRequisite = true
     *          - reduce requisites.totalRequired by arr.length
     *          - unshift arr into requests (puts requisites at the front gradually)
     *
     * This keeps the original distribution heuristic intact.
     *
     * @private
     * @param {Array<Object>} requests - Requests array (the non-reserved part produced earlier).
     * @param {Object} requisites - Object produced by _createRequisitesRequests
     * @returns {Array<Object>} Combined requests array with requisites distributed at the front.
     */
    _mergeRequisiteRequests(requests, requisites) {
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
     * Creates a subset of batch requests based on the current total capacity.
     *
     * @private
     * @param {Object[]} requests - Batch requests array.
     * @returns {Object[]} Subset of batch requests limited by the window size factor.
     */
    _createBatchWindow(requests) {
        const windowSize = Math.round(this.totalCapacityNow * this.windowSizeFactor);
        const requestsWindow = requests.slice(0, windowSize);
        return requestsWindow;
    }

    /**
     * Adds hot worker requests to both batch and streaming request arrays.
     *
     * @private
     * @param {Object[]} batchRequests - Array of batch requests.
     * @param {Object[]} streamingRequests - Array of streaming requests.
     * @param {Object} algorithmTemplateStore - Algorithm definitions from DB.
     * @returns {{ hotBatchRequests: Object[], hotStreamingRequests: Object[] }}
     *          Batch and streaming requests updated with hot worker requests.
     */
    _addHotRequests(batchRequests, streamingRequests, algorithmTemplateStore) {
        const hotBatchRequests = normalizeHotRequestsByType(batchRequests, algorithmTemplateStore);
        const hotStreamingRequests = normalizeHotRequestsByType(streamingRequests, algorithmTemplateStore, [stateType.Stateful, stateType.Stateless]);
        return { hotBatchRequests, hotStreamingRequests };
    }

    /**
     * Calculates per-algorithm request counts, ratios, and required capacity.
     *
     * @private
     * @param {Object[]} totalRequests - Array of requests to analyze.
     * @param {number} [capacity] - Optional total capacity to distribute among algorithms.
     * @returns {{ total: number, algorithms: Object }}
     *          Object containing the total number of requests and per-algorithm statistics.
     */
    _calculateRequestRatios(totalRequests, capacity) {
        const requestStats = totalRequests.reduce((acc, req) => {
            if (!acc.algorithms[req.algorithmName]) {
                acc.algorithms[req.algorithmName] = {
                    count: 0,
                    list: []
                };
            }
            acc.algorithms[req.algorithmName].count += 1;
            acc.algorithms[req.algorithmName].list.push(req);
            acc.total += 1;
            return acc;
        }, { total: 0, algorithms: {} });

        if (capacity) {
            Object.values(requestStats.algorithms).forEach(stats => {
                stats.ratio = stats.count / requestStats.total;
                stats.required = stats.ratio * capacity;
            });
        }

        return requestStats;
    }

    /**
     * Restricts the number of requests per algorithm based on calculated capacity.
     *
     * For each algorithm, only allows requests up to the `required` count
     * defined in `requestTypes.algorithms[algorithmName].required`.
     * Requests beyond that limit for a given algorithm are excluded.
     *
     * @private
     * @param {Object[]} totalRequests - Array of requests to limit.
     * @param {{ total: number, algorithms: Object }} requestTypes - Result of `_calculateRequestRatios`
     *        containing per-algorithm stats with `required` counts.
     * @returns {Object[]} Limited array of requests, respecting per-algorithm capacity.
     */
    _limitRequestsByCapacity(totalRequests, requestTypes) {
        const capacityLimitedRequests = [];
        totalRequests.forEach(req => {
            const currentStats = this._calculateRequestRatios(capacityLimitedRequests);
            const { required: maxAllowedForAlgorithm } = requestTypes.algorithms[req.algorithmName];
            const algorithm = currentStats.algorithms[req.algorithmName];

            if (!algorithm || algorithm.count < maxAllowedForAlgorithm) {
                capacityLimitedRequests.push(req);
            }
        });
        return capacityLimitedRequests;
    }

    /**
     * Creates a combined list of requests in the following order:
     * 1. Requisite requests (from both streaming and batch, first streaming then batch).
     * 2. Remaining streaming requests.
     * 3. Remaining batch requests.
     *
     * @param {Array} batchRequests - List of batch-type requests.
     * @param {Array} streamingRequests - List of streaming-type requests.
     * @returns {Array} Combined and ordered list of all requests.
     */
    _mergeFinalRequests(batchRequests, streamingRequests) {
        const isRequisite = req => req.isRequisite;

        const requisites = [...streamingRequests, ...batchRequests].filter(isRequisite);
        const streaming = streamingRequests.filter(req => !isRequisite(req));
        const batch = batchRequests.filter(req => !isRequisite(req));

        return [...requisites, ...streaming, ...batch];
    }
}

module.exports = new RequestsManager();
