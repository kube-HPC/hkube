
const { gql } = require('graphql-request');

const query = gql`{ 
    pipelines {
                    list {
                    kind
                    name
                    priority
                    experimentName
                    triggers {
                        cron {
                        enabled
                        pattern
                        }
                    }
                    options {
                        debug
                        pending
                        batchTolerance
                        progressVerbosityLevel
                        ttl
                        concurrentPipelines {
                        amount
                        rejectOnFailure
                        }
                    }
                    nodes {
                        nodeName
                        algorithmName
                        ttl
                        includeInResult
                        batchOperation
                        metrics {
                        tensorboard
                        }
                        retry {
                        policy
                        limit
                        }
                    }
                
                    flowInput
                }
                    pipelinesCount
                   }
                }
`



module.exports = query