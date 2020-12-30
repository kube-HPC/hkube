const storage = require('@hkube/storage-manager');

const getS3Config = ({
    endpoint,
    accessKeyId,
    secretAccessKey,
    useSSL = false,
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

const getFSConfig = () => repositoryName => `
['remote "storage"']
    url = /var/tmp/fs/storage/${storage.hkubeDataSource.prefix}/${repositoryName}
[core]
    remote = storage
`;

const configMap = {
    fs: getFSConfig,
    s3: getS3Config,
};

module.exports = configMap;
