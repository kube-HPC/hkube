const { uuid } = require('@hkube/uid');

const createBuild = ({ buildId, env, filePath }) => {
    return {
        buildId: buildId || uuid(),
        algorithmName: "sort-alg",
        env,
        filePath,
        version: "5.0.0",
        imageTag: "5.0.0",
        fileExt: "gz",
        status: "pending",
        error: null,
        stack: null,
        result: null,
        progress: 0,
        startTime: 1556799896273,
        endTime: null,
        dependencyInstallCmd: "./install.sh"
    }
}

module.exports = { createBuild }