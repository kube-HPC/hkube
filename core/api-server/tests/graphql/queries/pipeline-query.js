
const { gql } = require('graphql-request');

const query = gql`{ 
    pipelines {
                    list 
                    pipelinesCount
                   }
                }
`



module.exports = query