const { gql } = require('apollo-server');
const algorithmBuildsTypeDefs = require('./schemas/algorithm-builder-schema');
const algorithmTypeDefs = require('./schemas/algorithm-schema');
const dataSourcesTypeDefs = require('./schemas/datasource-schema');
const discoveryTypeDefs = require('./schemas/discovery-schema');
const diskSpaceTypeDefs = require('./schemas/disk-space-schema');
const errorLogsTypeDefs = require('./schemas/error-logs-schema');
const experimentTypeDefs = require('./schemas/experiment-schema');
const jobTypeDefs = require('./schemas/job-schema');
const logsTypeDefs = require('./schemas/log-schema');
const nodeStatisticTypeDefs = require('./schemas/node-statistic-schema');
const pipelineTypeDefs = require('./schemas/pipeline-schema');
const pipelineStatsTypeDefs = require('./schemas/pipeline-stats-schema');
const preferedTypeDefs = require('./schemas/prefered-schema');

const SubscriptionIncNumbersTypeDefs = gql`
type Subscription {
    numberIncremented: Int
  }
  `;

const Query = gql`  
type Query {
    currentNumber: Int
  }  
  `;

const Subscription = gql`
type Subscription {
    numberIncremented: Int
    numberIncrementedOdd(number: Int): Int
  }
  `;

const types = [
    algorithmBuildsTypeDefs,
    algorithmTypeDefs,
    dataSourcesTypeDefs,
    discoveryTypeDefs,
    diskSpaceTypeDefs,
    errorLogsTypeDefs,
    experimentTypeDefs,
    jobTypeDefs,
    logsTypeDefs,
    nodeStatisticTypeDefs,
    pipelineTypeDefs,
    pipelineStatsTypeDefs,
    preferedTypeDefs,
    SubscriptionIncNumbersTypeDefs,
    Query,
    Subscription
];

module.exports = types;
