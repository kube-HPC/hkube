/** @typedef {import('@hkube/db/lib/DataSource').ExternalStorage} ExternalStorage */

/** @param {ExternalStorage} config */
const S3Config = ({
    endpoint,
    accessKeyId,
    secretAccessKey,
    useSSL,
    bucketName,
}) => repositoryName => `
['remote "storage"']
    url = s3://${bucketName}/${repositoryName}
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

/**
 * @type {(
 *     type: string,
 *     config: ExternalStorage
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
