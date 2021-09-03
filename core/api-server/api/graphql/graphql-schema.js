const { gql } = require('apollo-server');
const jobTypeDefs = require('./schemas/job-schema')
const discoveryTypeDefs = require('./schemas/discovery-schema');
const algorithmTypeDefs = require('./schemas/algorithm-schema');
const pipelineTypeDefs = require('./schemas/pipeline-schema');
const experimentTypeDefs = require('./schemas/experiment-schema');
const nodeStatisticTypeDefs = require('./schemas/node-statistic-schema');
const diskSpaceTypeDefs = require('./schemas/disk-space-schema');
const pipelineStatsTypeDefs = require('./schemas/pipeline-stats-schema');
const dataSourcesTypeDefs = require('./schemas/datasource-schema');
const algorithmBuildsTypeDefs = require('./schemas/algorithm-builder-schema');


const SubscriptionIncNumbersTypeDefs = gql`
type Subscription {
    numberIncremented: Int
  }
  `

const Query = gql`  
type Query {
    currentNumber: Int
  }  
  `
const Subscription = gql`
type Subscription {
    numberIncremented: Int
    numberIncrementedOdd(number: Int): Int
  }
  `
const types = [

  dataSourcesTypeDefs,
  algorithmBuildsTypeDefs,
  jobTypeDefs,
  algorithmTypeDefs,
  pipelineTypeDefs,
  experimentTypeDefs,
  nodeStatisticTypeDefs,
  diskSpaceTypeDefs,
  pipelineStatsTypeDefs,
  SubscriptionIncNumbersTypeDefs,
  Query,
  Subscription
];

module.exports = types;