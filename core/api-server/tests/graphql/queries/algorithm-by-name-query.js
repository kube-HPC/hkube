const { gql } = require('graphql-request');
const query = gql`{
   algorithmsByName(name: "green-alg")
}`;


module.exports = query;