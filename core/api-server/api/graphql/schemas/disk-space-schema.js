const { gql } = require('apollo-server');

const diskSpaceTypeDefs = gql`
type DiskSpace { size: String free: String }
extend type Query {
    diskSpace:DiskSpace
 } 
`;

module.exports = diskSpaceTypeDefs;
