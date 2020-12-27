const storage = require('@hkube/storage-manager');

const { HKUBE_DATASOURCE } = storage.STORAGE_PREFIX.STORAGE_PREFIX;
const getS3Config = ({
    endpoint,
    accessKeyId,
    secretAccessKey,
    useSSL = false,
}) => repositoryName => `
[core]
    remote = storage
['remote "storage"']
    url = s3://${HKUBE_DATASOURCE}/${repositoryName}
    endpointurl = ${endpoint}
    access_key_id = ${accessKeyId}
    secret_access_key = ${secretAccessKey}
    use_ssl = ${useSSL}
`;

const getFSConfig = repositoryName => `
['remote "storage"']
    url = /var/tmp/fs/storage/${HKUBE_DATASOURCE}/${repositoryName}
`;

module.exports = {
    getS3Config,
    getFSConfig,
};
