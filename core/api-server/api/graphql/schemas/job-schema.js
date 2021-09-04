const { gql } = require('apollo-server');



const jobTypeDefs = gql`

scalar Object


input Range {
  from: String,
  to:String

}


type Results { 
    startTime: Float
    pipeline: String
    status: String
    timestamp: Float
    timeTook: Float
    data: Data 
}

  type Discovery { host: String port: String }



  type Metadata { values: Object }

  type StorageInfo { path: String size: Int }

  type Output { 
      taskId: String
    discovery: Discovery
    metadata: Metadata
    storageInfo: StorageInfo
 }

  type NodeInput { path: String }

  type JobNodes { 
    nodeName: String
    algorithmName: String
    taskId: String
    podName: String
    status: String
    startTime: Float
    endTime: Float
    level: Int
    batch: String
    boards: [String ]
    output: Output
    input: [NodeInput ] }

  type Value { types: [String ] }

  type Edges { from: String to: String value: Value }

  type Graph { jobId: String
    timestamp: Float
    nodes: [JobNodes ]
    edges: [Edges ] }

  type States { succeed: Int }

  type Data { progress: Int details: String states: States }

  type Status { timestamp: Float
    status: String
    level: String
    pipeline: String
    data: Data }

  type LastRunResult { timestamp: Float status: String timeTook: Float }



  type FlowInputMetadata { storageInfo: StorageInfo metadata: Metadata }

  type Cron { enabled: Boolean pattern: String }

  type Triggers { cron: Cron }

  type Options { batchTolerance: Int
    progressVerbosityLevel: String
    ttl: Int }

  type Files { link: String }

  type FlowInput { files: Files }

  type Pipeline { name: String
    experimentName: String
    kind: String
    priority: Int
    startTime: Float
    types: [String ]
    lastRunResult: LastRunResult
    flowInputMetadata: FlowInputMetadata
    triggers: Triggers
    options: Options
    flowInput: FlowInput
    nodes: [JobNodes ] 
}

  type UserPipeline { name: String
    experimentName: String
    triggers: Triggers
    options: Options
    flowInput: FlowInput
    nodes: [JobNodes ] }

  type Job { key: String
    results: Results
    graph: Graph
    status: Status
    pipeline: Pipeline
    userPipeline: UserPipeline 
    cursor:String
    timeTook:String
    }

  type AggregatedJobs { jobs:[Job] ,cursor:String }


  extend type Query {
    jobsAggregated(experimentName:String, pipelineName:String, pipelineType:String, algorithmName:String, pipelineStatus:String,datesRange:Range,cursor:String,limit:Int): AggregatedJobs
    job(id: String!): Job
    jobsByExperimentName(experimentName: String!): [Job]
  }

  # Types with identical fields:
  # Green FlowInputfileslink

`


module.exports = jobTypeDefs;