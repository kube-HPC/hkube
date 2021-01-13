const { uid } = require('@hkube/uid');

class Build {
    constructor(options) {
        this.buildId = this._createBuildID(options.algorithmName);
        this.imageTag = this._generateImageTag();
        this.algorithm = options.algorithm;
        this.env = options.env;
        this.fileExt = options.fileExt;
        this.filePath = options.filePath;
        this.uploadPath = options.uploadPath;
        this.algorithmName = options.algorithmName;
        this.gitRepository = options.gitRepository;
        this.type = options.type;
        this.baseImage = options.baseImage;
        this.dependencyInstallCmd = options.dependencyInstallCmd;
    }

    _createBuildID(algorithmName) {
        return [algorithmName, uid({ length: 6 })].join('-');
    }

    _generateImageTag() {
        return uid({ length: 8 });
    }
}

module.exports = Build;
