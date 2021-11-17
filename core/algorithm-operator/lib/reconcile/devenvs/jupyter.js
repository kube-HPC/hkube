const { devenvStatuses, devenvTypes } = require('@hkube/consts');
const { StatusCodes } = require('http-status-codes');
const log = require('@hkube/logger').GetLogFromContainer();
const JupyterApi = require('./jupyterApi');
class Jupyter {
    constructor() {
        this._options = null;
        this._apiUrl = null;
        this._type = devenvTypes.JUPYTER;
    }

    async init(options) {
        await JupyterApi.init(options);
        // get api token
        await JupyterApi.updateToken();
    }

    async current() {
        const list = await this.list();
        const items = list.map(i => ({
            name: i.name,
            state: i.ready ? devenvStatuses.RUNNING : devenvStatuses.CREATING
        }));
        return items;
    }

    async get(name) {
        const list = await this.list();
        const server = list.find(s => s.name === name);
        return server;
    }

    async list() {
        const list = await JupyterApi.list();
        return list;
    }

    async create({ name }) {
        log.info(`Creating ${this._type} ${name}`);
        const status = await JupyterApi.create({ name });
        if (status === StatusCodes.CREATED) {
            const server = await this.get(name);
            log.info(`Created ${this._type} ${name} with status ${status}. Url: ${server.url}`);
            return {
                name: server.name,
                url: server.url
            };
        }
        return {
            name
        };
    }

    async remove({ name }) {
        log.info(`Removing ${this._type} ${name}`);
        await JupyterApi.remove({ name });
    }
}

module.exports = new Jupyter();
