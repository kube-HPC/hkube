const { gql } = require('apollo-server');

const diskSpaceTypeDefs = gql`
type DiskSpace { size: Int free: Int }

`;

module.exports = diskSpaceTypeDefs;
