const { gql } = require('apollo-server');

const healthMonitoringTypeDefs = gql`
  type ServiceHealth {
    serviceName: String
    status: Boolean
  }

  extend type Query {
    healthMonitoring: [ServiceHealth]
  }
`;

module.exports = healthMonitoringTypeDefs;
