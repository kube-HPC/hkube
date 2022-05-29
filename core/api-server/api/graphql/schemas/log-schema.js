const { gql } = require('apollo-server');
const logsTypeDefs = gql`

type Logs { 
  level: String
  timestamp: String
  message: String
}
type LogsMainType { logs: [Logs ] }

extend type Query {
    
    logsByQuery(podName: String!,taskId:String,source:String,nodeKind:String,logMode:String): [Logs]
}

`;

module.exports = logsTypeDefs;
