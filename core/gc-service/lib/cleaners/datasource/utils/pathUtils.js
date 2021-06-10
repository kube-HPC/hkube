const path = require('path');

const getDatasourcesInUseFolder = config => {
    return path.join(
        config.fs.baseDatasourcesDirectory,
        `${config.clusterName}-${config.directories.dataSourcesInUse}`
    );
};

module.exports = {
    getDatasourcesInUseFolder,
};
