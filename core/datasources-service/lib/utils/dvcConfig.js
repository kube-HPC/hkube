const storage = require('@hkube/storage-manager');
/** @typedef {import('./types').config} Config */

/** @param {Config} config */
const S3Config = ({
    s3: { endpoint, accessKeyId, secretAccessKey, useSSL },
}) => repositoryName => `
['remote "storage"']
    url = s3://${storage.hkubeDataSource.prefix}/${repositoryName}
    endpointurl = ${endpoint}
    access_key_id = ${accessKeyId}
    secret_access_key = ${secretAccessKey}
    use_ssl = ${useSSL}
[core]
    remote = storage
`;

const configMap = {
    s3: S3Config,
};

/** @type {(config: Config) => (repositoryName: string) => string} */
module.exports = config => {
    const generator = configMap[config.dvcStorage];
    if (!generator) {
        throw new Error(
            `Invalid config.dvcStorage, the available options are ${Object.keys(
                configMap
            ).join(', ')}`
        );
    }
    return generator(config);
};
