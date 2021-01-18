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

    /**
     * Creates .dvc files, updates the respective .gitignore file. **NOTE**: in
     * case of an *update*, if any data was stored on the .dvc file it will be deleted!
     *
     * @param {string} filePaths
     */
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

    /**
     * Moves .dvc files and updates gitignore
     *
     * @param {string} srcPath
     * @param {string} targetPath
     */
    move(srcPath, targetPath) {
        return this._execute('move', srcPath, targetPath);
    }

    async enrichMeta(file, rootField, payload) {
        const dvcFilePath = `${this.cwd}/${file}.dvc`;
        const fileContent = await fse.readFile(dvcFilePath);
        const dvcData = yaml.load(fileContent);
        const { meta = {} } = dvcData;
        const dvcHash = dvcData.outs[0].md5;
        if (meta[rootField] && dvcHash === meta._hkube_hash) return null;
        const extendedData = {
            ...dvcData,
            meta: {
                ...meta,
                [rootField]: payload,
                _hkube_hash: dvcHash,
            },
        };
        return fse.writeFile(dvcFilePath, yaml.dump(extendedData));
    }
}

module.exports = DvcClient;
