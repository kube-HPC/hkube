const { gql } = require('apollo-server');


const dataSourcesTypeDefs = gql`

type DataSources { 
    versionDescription: String
    name: String
    filesCount: Int
    avgFileSize: Float
    totalSize: Int
    id: String
    fileTypes: [String ]
 }

 extend type Query {
    dataSources:[DataSources]
 }
`

module.exports = dataSourcesTypeDefs;