const storage = require('@hkube/storage-manager');

const { HKUBE_DATASOURCE } = storage.STORAGE_PREFIX.STORAGE_PREFIX;
const getS3Config = ({
    endpoint,
    accessKeyId,
    secretAccessKey,
    useSSL = false,
}) => repositoryName => `
['remote "storage"']
    url = s3://${HKUBE_DATASOURCE}/${repositoryName}
    endpointurl = ${endpoint}
    access_key_id = ${accessKeyId}
    secret_access_key = ${secretAccessKey}
    use_ssl = ${useSSL}
[core]
    remote = storage
`;

const getFSConfig = repositoryName => `
['remote "storage"']
    url = /var/tmp/fs/storage/${HKUBE_DATASOURCE}/${repositoryName}
[core]
    remote = storage
`;

module.exports = {
    getS3Config,
    getFSConfig,
};
