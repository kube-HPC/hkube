const { stateType } = require('@hkube/consts');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const component = require('../../consts').components.REQUESTS_MANAGER;
const { normalizeHotRequests, normalizeRequests } = require('../normalize');

/**
 * Manages scheduling and prioritization of algorithm execution requests.
 */
class RequestsManager {
    constructor() {
        // Current scheduling capacity
        this._totalCapacityNow = 10;
    }

    /**
     * Prepares and prioritizes algorithm requests for scheduling.
     *
     * Pipeline steps:
     * 1. Normalize raw algorithm requests into a consistent structure.
     * 2. Filter out requests for algorithms that have reached `maxWorkers`.
     * 3. Prioritize quota-guaranteed algorithms (requisite requests).
     * 4. Split requests & algorithm templates into batch and streaming types.
     * 5. Handle batch and streaming request types.
     * 6. Merge streaming and batch into a final ordered list.
     *
     * @param {Object[]} algorithmRequests - Incoming raw algorithm requests from etcd.
     * @param {Object} algorithmTemplates - Algorithm definitions from DB.
     * @param {Object[]} jobAttachedWorkers - Workers with their assigned jobs.
     * @param {Object} allAllocatedJobs - All allocated jobs with keys: idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, boostrappingWorkers.
     */
    prepareAlgorithmRequests(algorithmRequests, algorithmTemplates, jobAttachedWorkers, allAllocatedJobs) {
        // 1. Normalize incoming requests
        let requests = normalizeRequests(algorithmRequests, algorithmTemplates);

        // 2. Filter out requests exceeding maxWorkers limit
        requests = this._filterByMaxWorkers(algorithmTemplates, requests, jobAttachedWorkers);

        // 3. Move quota-guaranteed requests to the front
        requests = this._prioritizeQuotaRequisite(requests, algorithmTemplates, allAllocatedJobs);

        // 4. Categorize into batch and streaming
        let { batchRequests, streamingRequests } = this._splitRequestsByType(requests);
        const { batchTemplates, streamingTemplates } = this._splitAlgorithmsByType(algorithmTemplates);

        // 5. Handle batch and streaming requests separately
        batchRequests = this._handleBatchRequests(batchRequests, batchTemplates);
        streamingRequests = this._handleStreamingRequests(streamingRequests, streamingTemplates);

        // 6. Merge requisites, streaming, and batch into final list
        requests = this._merge(batchRequests, streamingRequests);

        return requests; // Final ordered list of requests for execution
    }

    /**
     * Updates the total capacity based on currently running algorithms.
     * @param {number} algorithmCount - Number of currently running algorithm workers.
     */
    updateCapacity(algorithmCount) {
        const factor = 0.9;
        const minCapacity = 2;
        const maxCapacity = 50;
        this._totalCapacityNow = this._totalCapacityNow * factor + algorithmCount * (1 - factor);
        this._totalCapacityNow = Math.max(minCapacity, Math.min(maxCapacity, this._totalCapacityNow));
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
        
        if (normalizedRequests.length > filtered.length) log.debug(`_filterByMaxWorkers - Filtered out ${normalizedRequests.length - filtered.length} requests`, { component });

        return filtered;
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
     * @param {Object} allAllocatedJobs - All allocated jobs with keys: idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, boostrappingWorkers.
     * @returns {Array<Object>} Prioritized requests (array ordered with requisites first).
     */
    _prioritizeQuotaRequisite(normRequests, algorithmTemplates, allAllocatedJobs) {
        const hasRequisiteAlgorithms = normRequests.some(r => algorithmTemplates[r.algorithmName]?.quotaGuarantee);

        if (hasRequisiteAlgorithms) {
            const { requests, requisites } = this._createRequisitesRequests(normRequests, algorithmTemplates, allAllocatedJobs);
            const mergedWithRequisite = this._mergeRequisiteRequests(requests, requisites);
            if (requisites.totalRequired > 0) log.debug(`_prioritizeQuotaRequisite - Got ${requisites.totalRequired} requisite requests out of ${normRequests.length} requests`, { component });
            return mergedWithRequisite;
        }
        return normRequests;
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
     * @param {Object} allAllocatedJobs - All allocated jobs with keys: idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, boostrappingWorkers.
     * @param {Array<Object>} allAllocatedJobs.idleWorkers - Idle workers list.
     * @param {Array<Object>} allAllocatedJobs.activeWorkers - Active workers list.
     * @param {Array<Object>} allAllocatedJobs.pausedWorkers - Paused workers list.
     * @param {Array<Object>} allAllocatedJobs.jobsPendingForWorkers - Jobs pending for workers list (jobs with no worker).
     * @param {Array<Object>} allAllocatedJobs.bootstrappingWorkers - bootstrappingWorkers workers list.
     * @returns {{requests: Array<Object>, requisites: Object}} 
     *          - requests: the requests array excluding those reserved for requisites
     *          - requisites: object { algorithms: { <alg>: { required: [requests...] } }, totalRequired: number }
     */
    _createRequisitesRequests(normalizedRequests, algorithmTemplates, allAllocatedJobs) {
        const requests = [];
        const visited = {};
        const indicesToIgnore = {};
        const requisites = { algorithms: {}, totalRequired: 0 };

        // combine the running workers into a single list to count running per algorithm
        const runningWorkersList = Object.values(allAllocatedJobs).flat();
        const runningWorkersMap = this._workersToMap(runningWorkersList);

        normalizedRequests.forEach((request, index) => {
            const { algorithmName } = request;
            const quotaGuarantee = algorithmTemplates[algorithmName]?.quotaGuarantee;

            if (quotaGuarantee && !visited[algorithmName]) {
                visited[algorithmName] = true;
                const runningCount = runningWorkersMap[algorithmName] || 0;
                const missing = quotaGuarantee - runningCount;

                if (missing > 0) {
                    // pick up to `missing` requests for this algorithm from the full normalizedRequests array
                    const required = normalizedRequests
                        .map((req, idx) => ({ index: idx, alg: req }))
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
            else if (!indicesToIgnore[index]) {
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
        const mergedRequisiteRequests = [...requests];
        const totalRequiredCount = requisites.totalRequired;

        while (requisites.totalRequired > 0) {
            Object.values(requisites.algorithms)
                .sort((a, b) => b.required.length - a.required.length) // Sort by length descending, since first we want to handle requests which has more requisite
                .forEach((v) => {
                    const ratio = (v.required.length / totalRequiredCount);
                    const required = Math.round(v.required.length * ratio) || 1;

                    // Make sure we don't pull more than what's left
                    const total = Math.min(requisites.totalRequired, required);
                    
                    const requisitesToAdd = v.required.slice(0, total);
                    const requisiteMarked = requisitesToAdd.map(req => ({
                        ...req,
                        isRequisite: true
                    }));

                    requisites.totalRequired -= requisitesToAdd.length;
                    mergedRequisiteRequests.unshift(...requisiteMarked);
                });
        }
        return mergedRequisiteRequests;
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
    _splitRequestsByType(requests) {
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
        return { batchRequests, streamingRequests };
    }

    /**
     * Splits a list of algorithm templates into batch and streaming categories.
     * Streaming templates include both Stateful and Stateless types.
     *
     * @private
     * @param {Object} algorithmTemplates - Object of algorithm templates objects.
     * @returns {{ batchRequests: Object[], streamingRequests: Object[] }}
     *          An object containing separate arrays for batch and streaming requests.
     */
    _splitAlgorithmsByType(algorithmTemplates = {}) {
        const batchTemplates = {};
        const streamingTemplates = {};
        const streamingStateTypes = [stateType.Stateful, stateType.Stateless];

        Object.entries(algorithmTemplates).forEach(([algName, algSpec]) => {
            if (!algSpec.stateType) {
                batchTemplates[algName] = algSpec;
            }
            else if (streamingStateTypes.includes(algSpec.stateType)) {
                streamingTemplates[algName] = algSpec;
            }
        });

        return { batchTemplates, streamingTemplates };
    }

    /**
     * Handles batch requests type processing process:
     * 1. Create a batch window based on available capacity.
     * 2. Include hot worker requests.
     * 3. Calculate per-algorithm ratios and required request counts.
     * 4. Cutting requests to match capacity per algorithm.
     *
     * @private
     * @param {Object[]} requests - Array of batch request type.
     * @param {Object} batchTemplates - Array of batch algorithm templates objects.
     * @returns {Object[]} An array containing processed batch requests.
     */
    _handleBatchRequests(requests, batchTemplates) {
        // Create a limited batch window in order to handle batch requests gradually.
        requests = this._createBatchWindow(requests);

        // Add hot worker requests
        const beforeHotLength = requests.length;
        requests = normalizeHotRequests(requests, batchTemplates);
        if (requests.length > beforeHotLength) log.debug(`_handleBatchRequests - Added ${requests.length - beforeHotLength} hot batch requests`, { component });

        // Limit requests amount to required per-algorithm count
        requests = this._limitRequestsByCapacity(requests);

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
        const windowSizeFactor = 3; // Factor for calculating the request window size
        const windowSize = Math.round(this._totalCapacityNow * windowSizeFactor);
        const requestsWindow = requests.slice(0, windowSize);
        if (requests.length > requestsWindow.length) log.debug(`_createBatchWindow - Removed ${requests.length - requestsWindow.length} requests due window`, { component });
        return requestsWindow;
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
     * @returns {Object[]} Limited array of requests, respecting per-algorithm capacity.
     */
    _limitRequestsByCapacity(totalRequests) {
        // Calculate per-algorithm request ratios
        const requestTypes = this._calculateRequestRatios(totalRequests, this._totalCapacityNow);

        const capacityLimitedRequests = [];
        totalRequests.forEach(req => {
            const currentStats = this._calculateRequestRatios(capacityLimitedRequests);
            const { required: maxAllowedForAlgorithm } = requestTypes.algorithms[req.algorithmName];
            const algorithm = currentStats.algorithms[req.algorithmName];

            if (!algorithm || algorithm.count < maxAllowedForAlgorithm) {
                capacityLimitedRequests.push(req);
            }
        });
        if (totalRequests.length > capacityLimitedRequests.length) log.debug(`_limitRequestsByCapacity - Removed ${totalRequests.length - capacityLimitedRequests.length} requests`, { component });

        return capacityLimitedRequests;
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
     * Handles streaming requests type processing process:
     * 1. Create a batch window based on available capacity.
     * 2. Include hot worker requests.
     * 3. Calculate per-algorithm ratios and required request counts.
     * 4. Cutting requests to match capacity per algorithm.
     *
     * @private
     * @param {Object[]} requests - Array of streaming request type.
     * @param {Object} streamingTemplates - Array of streaming algorithm templates objects.
     * @returns {Object[]} An array containing processed streaming requests.
     */
    _handleStreamingRequests(requests, streamingTemplates) {
        const beforeHotLength = requests.length;
        // Add hot worker requests
        requests = normalizeHotRequests(requests, streamingTemplates);
        if (requests.length > beforeHotLength) log.debug(`_handleStreamingRequests - Added ${requests.length - beforeHotLength} hot streaming requests`, { component });

        return requests;
    }

    /**
     * Creates a combined list of requests in the following order:
     * 1. Requisite requests (from both streaming and batch), with streaming requisites first, followed by batch requisites.
     * 2. Remaining streaming requests, ordered by:
     *    a. Stateful streaming requests.
     *    b. Stateless streaming requests.
     * 3. Remaining batch requests.
     *
     * @private
     * @param {Array<Object>} batchRequests - List of batch-type request objects.
     * @param {Array<Object>} streamingRequests - List of streaming-type request objects.
     * @returns {Array<Object>} Combined and ordered list of all request objects.
     */
    _merge(batchRequests, streamingRequests) {
        const isRequisite = req => req.isRequisite;

        const requisites = [...streamingRequests, ...batchRequests].filter(isRequisite);

        const nonRequisiteStreaming = streamingRequests.filter(request => !isRequisite(request));
        const statefulStreaming = nonRequisiteStreaming.filter(request => request.requestType === stateType.Stateful);
        const statelessStreaming = nonRequisiteStreaming.filter(request => request.requestType === stateType.Stateless);

        const nonRequisiteBatch = batchRequests.filter(request => !isRequisite(request));

        const merged = [
            ...requisites,
            ...statefulStreaming,
            ...statelessStreaming,
            ...nonRequisiteBatch
        ];
        if (merged.length > 0) log.debug(`_merge - Got a total of ${merged.length} valid requests`, { component });
        return merged;
    }
}

module.exports = new RequestsManager();
