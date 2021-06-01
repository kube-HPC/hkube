const formatter = require('../../lib/helpers/formatters');

const config = {};
config.algorithmQueueBalancer = {
    limit: formatter.parseInt(process.env.ALGORITHM_QUEUE_CONCURRENCY_LIMIT, 10)
};
module.exports = config;
