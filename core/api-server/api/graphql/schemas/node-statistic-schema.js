const { gql } = require('apollo-server');

const nodeStatisticTypeDefs = gql` 
type AlgorithmsData { name: String amount: Int size: Float }

type Results { name: String algorithmsData: [AlgorithmsData ] }

type NodeStatistics { metric: String
  legend: [String ]
  results: [Results ] }

 extend type Query {
    nodeStatistics:[NodeStatistics]
 } 
`


module.exports = nodeStatisticTypeDefs;