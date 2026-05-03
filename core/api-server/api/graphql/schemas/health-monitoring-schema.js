const { gql } = require('apollo-server');

const healthMonitoringTypeDefs = gql`
  type ServiceHealth {
    serviceName: String
    status: Boolean
  }

  type HealthMonitoringResult {
    services: [ServiceHealth]
    overallHealthStatus: Boolean
  }

  extend type Query {
    healthMonitoring: HealthMonitoringResult
  }
`;

module.exports = healthMonitoringTypeDefs;
