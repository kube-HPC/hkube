const Logger = require('@hkube/logger');
const KubernetesClient = require('@hkube/kubernetes-client').Client;
const objectPath = require('object-path');
const { components, containers, sidecars } = require('../consts');
const { settings } = require('./settings');
const { cacheResults } = require('../utils/utils');
const { kaiValues } = require('../consts');
const component = components.K8S;
const CONTAINERS = containers;

let log;

class KubernetesApi {
    async init(options = {}) {
        log = Logger.GetLogFromContainer();
        this._warnWasLogged = { crdMissing: false, noLimitRange: false, moreThanOneLimit: false }; // To avoid spamming the logs
        this._client = new KubernetesClient();
        await this._client.init(options.kubernetes);
        this._isNamespaced = options.kubernetes.isNamespaced;
        this._hasNodeList = options.kubernetes.hasNodeList;
        this._defaultQuota = options.resources.defaultQuota;
        log.info(`Initialized kubernetes client with options ${JSON.stringify({ ...options.kubernetes, url: this._client._config.url })}`, { component });
        if ((options.cacheResults || {}).enabled) {
            this.getVersionsConfigMap = cacheResults(this.getVersionsConfigMap.bind(this), 5000);
            this.getResourcesPerNode = cacheResults(this.getResourcesPerNode.bind(this), 1000);
            this.getWorkerJobs = cacheResults(this.getWorkerJobs.bind(this), 1000);
        }
        settings.sidecars = await this.getSidecarConfigs();
    }

    async createJob({ spec, jobDetails = {} }) {
        log.info(`Creating job ${spec.metadata.name}${jobDetails.hotWorker ? ' [hot-worker]' : ''}`, { component });
        try {
            const res = await this._client.jobs.create({ spec });
            return { ...res, jobDetails };
        }
        catch (error) {
            log.throttle.error(`unable to create job ${spec.metadata.name}. error: ${error.message}`, { component }, error);
            const { message, statusCode } = error;
            return { jobDetails, statusCode, message, spec };
        }
    }

    async getWorkerJobs() {
        const jobsRaw = await this._client.jobs.get({ labelSelector: `type=${CONTAINERS.WORKER},group=hkube` });
        return jobsRaw;
    }

    async getPodsForJob(job) {
        if (!job) {
            return [];
        }
        const podSelector = objectPath.get(job, 'spec.selector.matchLabels');
        if (!podSelector) {
            return [];
        }
        const pods = await this._client.pods.get({ labelSelector: podSelector });
        return pods;
    }

    async getVersionsConfigMap() {
        const res = await this._client.configMaps.get({ name: 'hkube-versions' });
        return this._client.configMaps.extractConfigMap(res);
    }

    async getSidecarConfigs() {
        const ret = await Promise.allSettled(Object.values(sidecars).map(s => this._client.sidecars.get({ name: s })));
        return ret.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    }

    async _getNamespacedResources() {
        const podsRaw = await this._client.pods.all(true);
        const pods = {
            body: {
                items: podsRaw.body.items.map((p) => {
                    objectPath.set(p, 'spec.nodeName', 'virtual-node');
                    return p;
                })
            }
        };
        const quota = await this._client.resourcequotas.get();
        const hard = objectPath.get(quota, 'body.items.0.spec.hard', this._defaultQuota);
        const cpu = hard['limits.cpu'] || this._defaultQuota['limits.cpu'];
        const memory = hard['limits.memory'] || this._defaultQuota['limits.memory'];
        const gpu = hard['requests.nvidia.com/gpu'] || this._defaultQuota['requests.nvidia.com/gpu'];

        const node = {
            metadata: {
                name: 'virtual-node'
            },
            status: {
                allocatable: {
                    cpu,
                    memory,
                    'nvidia.com/gpu': gpu
                }
            }
        };
        const nodes = {
            body: {
                items: [
                    node
                ]
            }
        };
        return { pods, nodes };
    }

    async _getNamespacedWithNodeListResources() {
        const pods = await this._client.pods.all(true);
        const nodesConfigMap = await this._client.configMaps.get({ name: 'hkube-nodes' });
        let nodes = { items: [] };
        if (nodesConfigMap && nodesConfigMap.body.data['nodes.json']) {
            nodes = JSON.parse(nodesConfigMap.body.data['nodes.json']);
        }
        return { pods, nodes: { body: nodes } };
    }

    async getResourcesPerNode() {
        if (this._isNamespaced && this._hasNodeList) {
            return this._getNamespacedWithNodeListResources();
        }
        if (this._isNamespaced) {
            return this._getNamespacedResources();
        }
        const [pods, nodes] = await Promise.all([this._client.pods.all(), this._client.nodes.all()]);
        return { pods, nodes };
    }

    /**
     * Fetches the names of all PersistentVolumeClaims (PVCs) in the Kubernetes cluster.
     *
     * @async
     * @function getAllPVCNames
     * @returns {Promise<string[]>} A promise that resolves to an array of PVC names.
     * @throws {Error} Throws an error if there is an issue while fetching PVCs.
     */
    async getAllPVCNames() {
        try {
            const pvc = await this._client.pvc.all(true);
            const names = pvc.body.items.map(p => p.metadata.name);
            return names;
        }
        catch (error) {
            log.error(`Error fetching PVCs: ${error.message}`, { component }, error);
            return [];
        }
    }

    /**
    * Fetches the names of all Secrets in the Kubernetes cluster.
    *
    * @async
    * @returns {Promise<string[]>} A promise that resolves to an array of Secret names.
    * @throws {Error} Throws an error if there is an issue while fetching Secrets.
        */
    async getAllSecretNames() {
        try {
            const secrets = await this._client.secrets.get({ secretName: '' });
            const names = secrets.body.items.map(secret => secret.metadata.name);
            return names;
        }
        catch (error) {
            log.error(`Error fetching Secrets: ${error.message}`, { component }, error);
            return [];
        }
    }

    /**
     * Fetches the names of all ConfigMaps in the Kubernetes cluster.
     *
     * @async
     * @returns {Promise<string[]>} A promise that resolves to an array of ConfigMap names.
     * @throws {Error} Throws an error if there is an issue while fetching ConfigMaps.
     */
    async getAllConfigMapNames() {
        try {
            const configMaps = await this._client.configMaps.get({ name: '' });
            const names = configMaps.body.items.map(configMap => configMap.metadata.name);
            return names;
        }
        catch (error) {
            log.error(`Error fetching ConfigMaps: ${error.message}`, { component }, error);
            return [];
        }
    }

    /**
     * Fetches the names of all Kai Queues in the cluster, if available.
     * 
     * This method first checks if the Kai Queues CRD is installed and served.
     * If so, it queries for queue resources using the discovered API version.
     * Returns an empty array if the CRD is missing or access is denied.
     *
     * @async
     * @function getAllQueueNames
     * @returns {Promise<string[]>} A promise that resolves to an array of queue names, or an empty array if Kai is not installed or inaccessible.
     */
    async getAllQueueNames() {
        try {
            // Check if Kai Queues CRD exists
            const crdList = await this._client.crds.all({
                group: kaiValues.KUBERNETES.CRD_GROUP,
                version: kaiValues.KUBERNETES.CRD_VERSION,
                resource: kaiValues.KUBERNETES.CRD_RESOURCE
            });

            const exists = crdList?.body?.items?.some(cr => cr.metadata.name === kaiValues.KUBERNETES.QUEUES_CRD_NAME);

            if (!exists) {
                if (!this._warnWasLogged.crdMissing) {
                    log.warning(`Kai Queues CRD (${kaiValues.KUBERNETES.QUEUES_CRD_NAME}) not found. Assuming Kai is not installed.`, { component });
                    this._warnWasLogged.crdMissing = true;
                }
                return [];
            }
            this._warnWasLogged.crdMissing = false;

            const crd = crdList.body.items.find(cr => cr.metadata.name === kaiValues.KUBERNETES.QUEUES_CRD_NAME);
            const version = crd?.spec?.versions?.find(v => v.served)?.name;

            const queuesList = await this._client.crds.all({
                group: kaiValues.KUBERNETES.QUEUES_API_GROUP,
                version,
                resource: kaiValues.KUBERNETES.RESOURCE
            });

            return queuesList.body.items.map(q => q.metadata.name);
        }
        catch (error) {
            log.error(`Error fetching Kai Queues: ${error.message}`, { component }, error);
            return [];
        }
    }

    /**
     * Get default CPU and memory requests/limits for containers
     * from LimitRange resources in the namespace.
     */
    async getContainerDefaultResources() {
        try {
            const res = await this._client.limitRanges.all();
            const items = res.body?.items || [];

            const containerLimits = items
                .flatMap(item => item.spec.limits.map(limit => ({
                    ...limit,
                    source: item.metadata?.name,
                })))
                .filter(limit => limit.type === 'Container');

            if (containerLimits.length === 0) {
                if (!this._warnWasLogged.noLimitRange) {
                    log.warning('No LimitRange with type=Container found.', { component });
                    this._warnWasLogged.noLimitRange = true;
                }
                return {};
            }
            this._warnWasLogged.noLimitRange = false; // Reset warning flag if situation is resolved

            if (containerLimits.length > 1 && !this._warnWasLogged.moreThanOneLimit) {
                log.warning(`Multiple LimitRanges with type=Container found: ${containerLimits.map(l => l.source)}. Taking the first one.`, { component });
                this._warnWasLogged.moreThanOneLimit = true;
            }
            else this._warnWasLogged.moreThanOneLimit = false; // Reset warning flag if situation is resolved

            const selected = containerLimits[0];

            return {
                cpu: {
                    defaultRequest: selected.defaultRequest?.cpu,
                    defaultLimits: selected.default?.cpu
                },
                memory: {
                    defaultRequest: selected.defaultRequest?.memory,
                    defaultLimits: selected.default?.memory
                }
            };
        } 
        catch (error) {
            log.error(`Failed to fetch container default resources ${error.message}`, { component }, error);
            return {};
        }
    }
}

module.exports = new KubernetesApi();
module.exports.KubernetesApi = KubernetesApi;
