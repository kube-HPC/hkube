const axios = require('axios').default;
const { main } = require('@hkube/config').load();
const { protocol, host, port } = main.jaeger;
const baseUri = `${protocol}://${host}:${port}/jaeger/api/traces`;

const pathByJobID = jobId => `${baseUri}?service=api-server&tags={"jobId":"${jobId}"}`;

const pipeTrace = async (jobId, res) => {
    const url = pathByJobID(jobId);
    const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream'
    });
    response.data.pipe(res);
};

module.exports = {
    pipeTrace
};
