const {gql } = require('graphql-request');
const query = gql`{
  job(id:"job_2" ) {
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
            pipelineDriver {
              driverId
              podName
              idle
              paused
              status
              max
              capacity
              jobs {
                jobId
                active
                pipelineName
              }
            }
         
            worker {
              workerStatus
              isMaster
              workerStartingTime
              jobCurrentTime
              workerPaused
              hotWorker
              error
              workerId
              algorithmName
              podName
             
            }
          }
          metadata {
            values
          }
          storageInfo {
            path
            size
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
}`;


module.exports = query;
