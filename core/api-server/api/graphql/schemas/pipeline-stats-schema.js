const { gql } = require('apollo-server');

const pipelineStatsTypeDefs = gql`
type Stats { status: String count: Int }
type PipelinesStats { name: String stats: [Stats ] }

extend type Query {
    pipelineStats:[PipelinesStats]  
}
`;

module.exports = pipelineStatsTypeDefs;
