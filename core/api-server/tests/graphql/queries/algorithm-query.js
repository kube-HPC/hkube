const {gql } = require('graphql-request');
const query = gql`{
    algorithms {
      list {
        name
        cpu
        created
        entryPoint
        env
        gpu
        mem
        minHotWorkers
        modified
        reservedMemory
        type
        algorithmImage
        version
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
        gitRepository {
          gitKind
          url
          branchName
          webUrl
          cloneUrl
          commit {
            id
            timestamp
            message
          }
        }
        buildStats {
          total
          pending
          creating
          active
          completed
          failed
          stopped
        }
      }
      algorithmsCount
    }
  }`;


  module.exports = query;