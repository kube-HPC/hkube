const { devenvStatuses, devenvTypes } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const kubernetes = require('../../helpers/kubernetes');
const { createSpec } = require('../../deployments/devenv');
const { createIngressPath } = require('../../templates/devenv');

const { DEVENV } = require('../../consts/containers');
const { DEVENV: DEVENV_COMPONENT } = require('../../consts/componentNames');
class Vscode {
    constructor() {
        this._options = null;
        this._type = devenvTypes.VSCODE;
        this._labelSelector = `devenv-type=${this._type},type=${DEVENV}`;
    }

    async init(options) {
        this._options = options;
        if (!this._options.enable) {
            return;
        }
        log.info(`Initializing ${this._type}`, { DEVENV_COMPONENT });
    }

    async current() {
        if (!this._options?.enable) {
            return [];
        }
        const list = await this.list();
        const items = list.map(i => ({
            name: i.name,
            status: i.ready ? devenvStatuses.RUNNING : devenvStatuses.CREATING
        }));
        return items;
    }

    async get(name) {
        if (!this._options.enable) {
            return null;
        }
        const list = await this.list();
        const server = list.find(s => s.name === name);
        return server;
    }

    async list() {
        if (!this._options.enable) {
            return [];
        }
        const listRaw = await kubernetes.getDeployments({ labelSelector: this._labelSelector });
        const list = listRaw.body.items.map(i => ({
            name: i.metadata.labels.name || i.metadata.name,
            ready: i.status.availableReplicas === i.status.replicas
        }));
        return list;
    }

    async create({ name }, createOptions) {
        if (!this._options.enable) {
            return null;
        }
        log.info(`Creating ${this._type} ${name}`, { DEVENV_COMPONENT });
        const { deploymentSpec, ingressSpec, serviceSpec, storageSpec } = createSpec({ name, type: this._type, devenvResources: this._options.resources, storage: this._options.storage, password: this._options.password, ...createOptions });
        await kubernetes.deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, storageSpec, name }, this._type);
        return {
            name,
            url: `${createIngressPath(name, this._type)}/`,
            status: devenvStatuses.CREATING
        };
    }

    async delete({ name }) {
        if (!this._options.enable) {
            return;
        }
        log.info(`Removing ${this._type} ${name}`, { DEVENV_COMPONENT });
        await kubernetes.deleteExposedDeployment(name, this._type);
    }

    async stop({ name }) {
        if (!this._options.enable) {
            return;
        }
        log.info(`Stopping ${this._type} ${name}`, { DEVENV_COMPONENT });
        await kubernetes.deleteExposedDeployment(name, this._type, false);
    }
}

module.exports = new Vscode();
