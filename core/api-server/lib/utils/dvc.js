const configDvcToS3 = ({
    host,
    port,
    bucketName,
    repositoryName,
    accessKeyId,
    secretAccessKey,
    useSSL = false
}) => `
[core]
    remote = storage
['remote "storage"']
    url = s3://${bucketName}/${repositoryName}
    endpointurl = ${host}:${port}
    access_key_id = ${accessKeyId}
    secret_access_key = ${secretAccessKey}
    use_ssl = ${useSSL}
`;

const configDvcToFs = ({ repositoryName }) => `
['remote "storage"']
    url = /var/tmp/fs/storage/local-hkube-dvc/${repositoryName}
`;

module.exports = {
    configDvcToS3,
    configDvcToFs
};
