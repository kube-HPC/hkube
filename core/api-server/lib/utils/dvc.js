const getS3Config = ({
    endpoint,
    bucketName,
    accessKeyId,
    secretAccessKey,
    useSSL = false
}) => (repositoryName) => `
[core]
    remote = storage
['remote "storage"']
    url = s3://${bucketName}/${repositoryName}
    endpointurl = ${endpoint}
    access_key_id = ${accessKeyId}
    secret_access_key = ${secretAccessKey}
    use_ssl = ${useSSL}
`;

const getFSConfig = (repositoryName) => `
['remote "storage"']
    url = /var/tmp/fs/storage/local-hkube-dvc/${repositoryName}
`;

module.exports = {
    getS3Config,
    getFSConfig
};
