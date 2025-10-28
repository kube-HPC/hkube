const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { warningCodes } = require('@hkube/consts');
const { components } = require('../consts');
const component = components.RECONCILER;

/**
 * Creates a base warning object (used in pipeline driver) for algorithm scheduling issues.
 *
 * @private
 * @param {Object} params - Warning parameters.
 * @param {string} params.algorithmName - Algorithm name.
 * @param {string} params.predictedStatus - Predicted algorithm status.
 * @param {boolean} [params.surpassTimeout=false] - Whether to apply immediately or wait.
 * @param {string} params.message - Warning message.
 * @param {number} params.code - Warning code.
 * @param {boolean} [params.isError=false] - Whether this is an error-level warning.
 * @param {Object} [params.additionalData] - Any additional data to attach.
 * @returns {Object} Warning object.
 */
const _createWarning = ({ algorithmName, predictedStatus, surpassTimeout = false, message, code, isError = false, ...additionalData }) => {
    const warning = {
        algorithmName,
        type: 'warning',
        reason: predictedStatus, // new status goes to node status in graph
        surpassTimeout, // should wait or instantly apply to graph
        message,
        timestamp: Date.now(),
        code,
        isError,
        ...additionalData // any additional data required for the pipeline driver.
    };
    return warning;
};

/**
 * Creates a resources-related scheduling warning.
 *
 * @private
 * @param {Object} params - Warning parameters.
 * @param {number} [params.unMatchedNodesBySelector] - Number of unmatched nodes, after nodeSelector filtering.
 * @param {Object} params.jobDetails - Job details object.
 * @param {Object[]} params.nodesForSchedule - List of nodes evaluated for scheduling with extra details.
 * @param {boolean} params.nodesAfterSelector - Whether nodes remain after selector filtering.
 * @param {number} params.code - Warning code.
 * @returns {Object} Warning object.
 */
const _createResourcesWarning = ({ unMatchedNodesBySelector, jobDetails, nodesForSchedule, nodesAfterSelector, requestedResources, code }) => {
    const messages = [];
    let ns = [];
    let complexResourceDescriptor;
    if (unMatchedNodesBySelector) {
        ns = Object.entries(jobDetails.nodeSelector).map(([k, v]) => `${k}=${v}`); // Key value array of selectors
        complexResourceDescriptor = {
            ...complexResourceDescriptor,
            requestedSelectors: ns,
            numUnmatchedNodesBySelector: unMatchedNodesBySelector
        };
    } // Handle selector info, and update info for the complexResourceDescriptor
    if (!nodesAfterSelector) {
        messages.push(`No nodes available for scheduling due to selector condition - '${ns.join(',')}'`);
    }
    
    let hasMaxCapacity = true;
    const resourcesMap = Object.create(null);
    const maxCapacityMap = Object.create(null);

    const nodes = [];
    nodesForSchedule.forEach(n => {
        // let nodeIndex = -1;
        let currentNode = {nodeName: n.node.name, amountsMissing: n.amountsMissing};
        const maxCapacity = Object.entries(n.maxCapacity).filter(([, v]) => v === true);
        if (maxCapacity.length === 0) {
            hasMaxCapacity = false;
        }
        maxCapacity.forEach(([k]) => {
            if (!maxCapacityMap[k]) {
                maxCapacityMap[k] = 0;
            }
            maxCapacityMap[k] += 1;
        });
        if (maxCapacity) {
            currentNode = {
                ...currentNode,
                requestsOverMaxCapacity: maxCapacity
            };         
        } // if requests exceed max capacity, add the array containing mem, cpu, gpu.
        const nodeMissingResources = Object.entries(n.details).filter(([, v]) => v === false);
        nodeMissingResources.forEach(([k]) => {
            if (!resourcesMap[k]) {
                resourcesMap[k] = 0;
            }
            resourcesMap[k] += 1;
        });
        nodes.push(currentNode);
    });
    // Valid node's total resource is lower than requested
    if (hasMaxCapacity && Object.keys(maxCapacityMap).length > 0) {
        const maxCapacity = Object.entries(maxCapacityMap).map(([k, v]) => `${k} (${v})`);
        messages.push(`Maximum capacity exceeded ${maxCapacity.join(' ')}`);
    }
    // Not enough resources in valid node
    else if (Object.keys(resourcesMap).length > 0) {
        const resources = Object.entries(resourcesMap).map(([k, v]) => `${k} (${v})`);
        messages.push(`Insufficient ${resources.join(', ')}`);
    }
    complexResourceDescriptor = {
        ...complexResourceDescriptor,
        nodes,
    };
    const { algorithmName } = jobDetails;
    const message = messages.join(', ');
    return _createWarning({
        algorithmName,
        predictedStatus: 'failedScheduling',
        surpassTimeout: hasMaxCapacity,
        message,
        code,
        complexResourceDescriptor,
        requestedResources
    });
};

/**
 * Creates a warning for missing or invalid volumes.
 *
 * @private
 * @param {Object} params - Warning parameters.
 * @param {Object} params.jobDetails - Job details object.
 * @param {string[]} params.missingVolumes - Missing volume names.
 * @param {number} params.code - Warning code.
 * @returns {Object} Warning object.
 */
const _createInvalidVolumeWarning = ({ jobDetails, missingVolumes, code }) => {
    const message = `One or more volumes are missing or do not exist.\nMissing volumes: ${missingVolumes.join(', ')}`;
    return _createWarning({
        algorithmName: jobDetails.algorithmName,
        predictedStatus: 'failedScheduling',
        message,
        code,
        isError: true,
        missingVolumes
    });
};

/**
 * Creates a warning when Kubernetes job creation fails.
 *
 * @private
 * @param {Object} params - Warning parameters.
 * @param {Object} params.jobDetails - Job details object.
 * @param {number} params.code - Warning code.
 * @param {string} params.message - Original error message.
 * @param {Object} params.spec - Kubernetes job spec.
 * @returns {Object} Warning object.
 */
const _createJobCreationFailedWarning = ({ jobDetails, code, message: givenMessage, spec }) => {
    const { algorithmName, algorithmVersion } = jobDetails;

    const _formatErrorMessage = (message) => {
        try {
            // 1. Replace "Job.batch <jobName>" with just "Job"
            message = message.replace(/^Job\.\w+ "\S+"/, 'Kubernetes Job');
    
            // 2. Extract the path (everything between "is invalid: " and the first colon)
            const pathMatch = message.match(/is invalid: ([^:]+):/);
            if (!pathMatch) return message; // If the path isn't found, return the original message
    
            const fullPath = pathMatch[1]; // The full path (e.g., spec.template.spec.containers[2].resources.requests)
            let formattedPath = fullPath;
    
            // 3. If the path contains a container index, replace it with the container name
            const containerMatch = fullPath.match(/containers\[(\d+)\]/);
            if (containerMatch) {
                const containerIndex = parseInt(containerMatch[1], 10);
                if (spec?.spec?.template?.spec?.containers && spec.spec.template.spec.containers[containerIndex]) {
                    const containerName = spec.spec.template.spec.containers[containerIndex].name;
                    // Replace the container reference with the actual name
                    formattedPath = fullPath.replace(/spec\.template\.spec\.containers\[\d+\]/, containerName);
                }
            }
    
            // 4. Construct the new message by replacing the path with its formatted version
            let formattedMessage = message.replace(fullPath, formattedPath);
    
            // 5. Remove unnecessary quotes from the reason part (anything inside quotes)
            formattedMessage = formattedMessage.replace(/"([^"]+)"/g, '$1');
    
            return formattedMessage.trim();
        }
        catch (error) {
            return message; // Return original message if anything goes wrong
        }
    };

    const message = _formatErrorMessage(givenMessage);

    return _createWarning({
        algorithmName,
        algorithmVersion,
        predictedStatus: 'failedScheduling',
        message,
        surpassTimeout: true,
        code,
        isError: true
    });
};

/**
 * Creates a Kai validation warning.
 *
 * @private
 * @param {Object} params - Warning parameters.
 * @param {Object} params.jobDetails - Job details object.
 * @param {string} params.message - Error message.
 * @param {boolean} params.isError - Whether this is an error-level warning.
 * @param {number} params.code - Warning code.
 * @returns {Object} Warning object.
 */
const _createKaiWarning = ({ jobDetails, message: givenMessage, isError, code }) => {
    const { algorithmName, algorithmVersion } = jobDetails;
    const message = `Kai object validation failed for algorithm ${algorithmName} version ${algorithmVersion}.\nError: ${givenMessage}`;
    return _createWarning({
        algorithmName,
        algorithmVersion,
        predictedStatus: 'failedScheduling',
        message,
        surpassTimeout: true,
        code,
        isError
    });
};

/**
 * Creates a default warning for unknown errors.
 *
 * @private
 * @param {Object} params - Warning parameters.
 * @param {Object} params.jobDetails - Job details object.
 * @param {string} [params.message] - Error message.
 * @param {number} [params.code=520] - Warning code.
 * @returns {Object} Warning object.
 */
const _createDefaultWarning = ({ jobDetails, message: givenMessage, code = 520 }) => {
    const message = `Unknown warning or error occured, message: ${givenMessage || 'Unknown'}`;
    log.info(message, { component });
    return _createWarning({
        algorithmName: jobDetails.algorithmName || 'Unknown',
        predictedStatus: 'failedScheduling',
        message,
        code
    });
};

/**
 * Creates a specific warning object based on the given warning code.
 *
 * @param {Object} options - Warning creation options.
 * @returns {Object} Warning object.
 */
const createWarning = (options = {}) => {
    const { code } = options;
    switch (code) {
        case warningCodes.INVALID_VOLUME:
            return _createInvalidVolumeWarning(options);
        case warningCodes.RESOURCES:
            return _createResourcesWarning(options);
        case warningCodes.JOB_CREATION_FAILED:
            return _createJobCreationFailedWarning(options);
        case warningCodes.KAI:
            return _createKaiWarning(options);
        default:
            return _createDefaultWarning(options);
    }
};

module.exports = {
    createWarning
};
