const { gql } = require('apollo-server');

const errorLogTypeDefs = gql`
type ErrorLog {
  type: String
  hostName: String
  uptime: String
  timestamp: String
  serviceName: String
  podName: String
  id: String
  level: String
  message: String
}


extend type Query {
    errorLogs:[ErrorLog]
}
`;
module.exports = errorLogTypeDefs;
