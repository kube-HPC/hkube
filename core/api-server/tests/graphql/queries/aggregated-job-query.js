const {gql } = require('graphql-request');
const query = gql`{
   jobsAggregated(pipelineName:"flow1"  ) {
    jobs {
      key
      results {
        startTime
        pipeline
        status
        timestamp
        timeTook
        data {
          progress
          details
          states {
            succeed
            failed
            stopped
            active
            creating
            preschedule
            pending
            skipped
            stalled
            warning
          }
        }
        name
        algorithmsData {
          name
          amount
          size
        }
      }
      graph {
        jobId
        timestamp
        nodes {
          nodeName
          algorithmName
          taskId
          podName
          status
          startTime
          endTime
          level
          batch {
          taskId
          podName
          status
          batchIndex
          startTime
          endTime
        }
          boards
          output {
            taskId
            discovery {
              host
              port
             
            }
          }
          input {
            path
          }
        }
        edges {
          from
          to
          value {
            types
          }
        }
      }
      status {
        timestamp
        status
        level
        pipeline
      }
      pipeline {
        name
        experimentName
        kind
        priority
        startTime
        types
        lastRunResult {
          timestamp
          status
          timeTook
        }
        flowInputMetadata {
          storageInfo {
            path
            size
          }
          metadata {
            values
          }
        }
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
        flowInput {
          files {
            path
            id
            name
            size
            type
            meta
            uploadedAt
            link
          }
          mul
          data
        }
      }
      userPipeline {
        name
        experimentName
      }
      cursor
      timeTook
    }
    cursor
    jobsCount
  }
}`;


module.exports = query;
