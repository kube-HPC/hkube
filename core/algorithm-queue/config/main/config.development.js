const formatter = require(process.cwd() + '/lib/utils/formatters'); // eslint-disable-line
const config = {};
config.algorithmQueueBalancer = {
    limit: formatter.parseInt(process.env.ALGORITHM_QUEUE_LIMIT, 10)
};
module.exports = config;
