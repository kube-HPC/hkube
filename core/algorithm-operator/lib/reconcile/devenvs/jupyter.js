const { devenvStatuses, devenvTypes } = require('@hkube/consts');
const { StatusCodes } = require('http-status-codes');
const log = require('@hkube/logger').GetLogFromContainer();
const JupyterApi = require('./jupyterApi');
const { DEVENV: DEVENV_COMPONENT } = require('../../consts/componentNames');

class Jupyter {
    constructor() {
        this._options = null;
        this._apiUrl = null;
        this._type = devenvTypes.JUPYTER;
    }

    async init(options) {
        this._options = options;
        if (!this._options.enable) {
            return;
        }
        await JupyterApi.init(options);
        // get api token
        await JupyterApi.updateToken();
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
        const list = await JupyterApi.list();
        return list;
    }

    async create({ name }) {
        if (!this._options.enable) {
            return null;
        }
        log.info(`Creating ${this._type} ${name}`, { DEVENV_COMPONENT });
        const status = await JupyterApi.create({ name });
        if (status === StatusCodes.CREATED || status === StatusCodes.OK || status === StatusCodes.ACCEPTED) {
            const server = await this.get(name);
            log.info(`Created ${this._type} ${name} with status ${status}. Url: ${server.url}`, { DEVENV_COMPONENT });
            return {
                name: server.name,
                url: server.url,
                status: server.ready ? devenvStatuses.RUNNING : devenvStatuses.CREATING
            };
        }
        return {
            name
        };
    }

    async delete({ name }) {
        if (!this._options.enable) {
            return;
        }
        log.info(`Removing ${this._type} ${name}`, { DEVENV_COMPONENT });
        await JupyterApi.delete({ name });
    }

    async stop({ name }) {
        if (!this._options.enable) {
            return;
        }
        log.info(`Stopping ${this._type} ${name}`, { DEVENV_COMPONENT });
        await JupyterApi.remove({ name });
    }
}

module.exports = new Jupyter();
