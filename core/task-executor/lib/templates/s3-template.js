
const awsAccessKeyId =
    {
        AWS_ACCESS_KEY_ID:
            {
                secretKeyRef: {
                    name: 's3-secret',
                    key: 'awsKey'
                }
            }
    };
const awsSecretAccessKey = {
    AWS_SECRET_ACCESS_KEY:
        {
            secretKeyRef: {
                name: 's3-secret',
                key: 'awsSecret'
            }
        }
};
const s3EndpointUrl = {
    S3_ENDPOINT_URL:
        {
            secretKeyRef: {
                name: 's3-secret',
                key: 'awsEndpointUrl'
            }
        }
};

module.exports = {
    awsAccessKeyId,
    awsSecretAccessKey,
    s3EndpointUrl
};
