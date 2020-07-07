const pathLib = require('path');
const fse = require('fs-extra');
const recursive = require('recursive-readdir');
const storageManager = require('@hkube/storage-manager');

class Boards {
    init(options) {
        this._algoMetricsDir = options.algoMetricsDir;
    }

    async putAlgoMetrics(jobData, jobCurrentTime) {
        let path = null;
        let error;
        try {
            const formatedDate = jobCurrentTime.toLocaleString().split('/').join('-');
            const files = await recursive(this._algoMetricsDir);
            const { taskId, jobId, nodeName, pipelineName } = jobData;
            const paths = await Promise.all(files.map((file) => {
                const stream = fse.createReadStream(file);
                const fileName = file.replace(this._algoMetricsDir, '');
                return storageManager.hkubeAlgoMetrics.putStream(
                    { pipelineName, taskId, jobId, nodeName, data: stream, formatedDate, fileName, stream }
                );
            }));
            const separatedPath = paths[0] && paths[0].path.split(pathLib.sep);
            path = separatedPath && separatedPath.slice(0, separatedPath.length - 1).join(pathLib.sep);
        }
        catch (err) {
            error = err.message;
        }
        finally {
            // eslint-disable-next-line no-unsafe-finally
            return {
                path,
                error
            };
        }
    }
}

module.exports = new Boards();
