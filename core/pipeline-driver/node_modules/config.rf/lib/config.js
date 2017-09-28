'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events').EventEmitter;
const deepExtend = require('deep-extend');
const logger = require('./logger');
const BASE_CONFIG = 'config.base.js';
const DEFAULT_CONFIG_FOLDER = 'config';

class ConfigIT extends EventEmitter {

    constructor() {
        super();
        this._env = process.env.NODE_ENV || 'dev'; // 'dev, pro
    }

    env() {
        return this._env;
    }

    async load(options) {
        options = options || {};
        options.configFolder = options.configFolder || '';
        const dir = options.cwd || process.cwd();
        const folders = fs.readdirSync(path.join(dir, options.configFolder, DEFAULT_CONFIG_FOLDER));
        const configs = Object.create(null);
        for (let folder of folders) {
            const config = await this._readConfigFromDisk({
                useBase: options.useBase !== false,
                configFolder: `${options.configFolder}/${DEFAULT_CONFIG_FOLDER}/${folder}`
            });
            configs[folder] = config;
        }
        return configs;
    }

    _readConfigFromDisk(options) {
        return new Promise((resolve, reject) => {
            const dir = options.cwd || process.cwd();
            const configFolder = options.configFolder || DEFAULT_CONFIG_FOLDER;
            const configEnvironment = configFolder + '/config.' + this._env + '.js';
            try {
                const envConfig = require(path.join(dir, configEnvironment));
                if (options.useBase === false) {
                    return resolve(envConfig);
                }
                const baseConfig = require(path.join(dir, configFolder, 'config.base.js'));
                const mergedConfig = deepExtend(baseConfig, envConfig);
                return resolve(mergedConfig);
            }
            catch (error) {
                return reject(error);
            }
        });
    }
}

module.exports = new ConfigIT();
