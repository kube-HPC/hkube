const S3Config = (
    { endpoint, bucketName },
    { accessKeyId, secretAccessKey }
) => repositoryName => `
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
    S3: S3Config,
};

module.exports = (type, config, credentials) => {
    const generator = configMap[type];
    if (!generator) {
        throw new Error(`Invalid config.dvcStorage, the available options are ${Object.keys(configMap).join(', ')}`);
    }
    return generator(config, credentials);
};
