const fse = require('fs-extra');
const yaml = require('js-yaml');
const Shell = require('./Shell');

class DvcClient {
    constructor(cwd, repositoryUrl, storageName = 'storage') {
        this.cwd = cwd;
        this.repositoryUrl = repositoryUrl;
        this._shell = Shell(cwd);
        this.storageName = storageName;
        this._execute = (...args) => this._shell('dvc', args.flat());
    }

    init() {
        return this._execute('init');
    }

    config(config) {
        return fse.writeFile(`${this.cwd}/.dvc/config`, config);
    }

    add(filePaths) {
        return this._execute(`add`, filePaths);
    }

    /** @param {{ path?: string; paths?: string[] }} */
    remove({ path, paths }) {
        if (path) return this._execute('remove', `${path}.dvc`);
        if (paths)
            return this._execute(
                'remove',
                paths.map(p => `${p}.dvc`)
            );
        throw new Error('you did not provide a path or paths to delete');
    }

    /** @param {string=} storageName */
    push(storageName) {
        return this._execute('push', '-r', storageName || this.storageName);
    }

    /** @param {string=} file */
    pull(filePath) {
        if (filePath)
            return this._execute(
                'get',
                this.repositoryUrl,
                filePath,
                '-o',
                filePath
            );
        return this._execute(`pull`);
    }

    move(srcPath, targetPath) {
        // moves .dvc files and updates gitignore
        return this._execute('move', srcPath, targetPath);
    }

    async enrichMeta(file, rootField, payload, shouldOverride = false) {
        const dvcFilePath = `${this.cwd}/${file}.dvc`;
        const fileContent = await fse.readFile(dvcFilePath);
        const dvcData = yaml.load(fileContent);

        const { meta = {} } = dvcData;
        if (meta[rootField] && !shouldOverride) return null;
        const extendedData = {
            ...dvcData,
            meta: {
                ...meta,
                [rootField]: payload,
            },
        };
        return fse.writeFile(dvcFilePath, yaml.dump(extendedData));
    }
}

module.exports = DvcClient;
