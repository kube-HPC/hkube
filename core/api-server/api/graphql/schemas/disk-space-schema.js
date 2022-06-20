const { gql } = require('apollo-server');

const diskSpaceTypeDefs = gql`
type DiskSpace { size: Int free: Int }
extend type Query {
    diskSpace:DiskSpace
 } 
`;

module.exports = diskSpaceTypeDefs;
