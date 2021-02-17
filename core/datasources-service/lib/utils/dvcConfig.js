/** @typedef {import('@hkube/db/lib/DataSource').StorageConfig} StorageConfig */

/** @param {StorageConfig} config */
const S3Config = ({
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
}) => repositoryName => `
['remote "storage"']
    url = s3://${bucketName}/${repositoryName}
    endpointurl = ${endpoint}
    access_key_id = ${accessKeyId}
    secret_access_key = ${secretAccessKey}
    use_ssl = ${!!new URL(endpoint).protocol.match('https')}
[core]
    remote = storage
`;

const configMap = {
    s3: S3Config,
};

/**
 * @type {(
 *     type: string,
 *     config: StorageConfig
 * ) => (repositoryName: string) => string}
 */
module.exports = (type, config) => {
    const generator = configMap[type];
    if (!generator) {
        throw new Error(
            `Invalid config.dvcStorage, the available options are ${Object.keys(
                configMap
            ).join(', ')}`
        );
    }
    return generator(config);
};
