const path = require('path');

const getDatasourcesInUseFolder = config => {
    return path.join(
        config.fs.baseDatasourcesDirectory,
        `${config.clusterName}-${config.dataSourcesVolume}`
    );
};

module.exports = {
    getDatasourcesInUseFolder,
};
