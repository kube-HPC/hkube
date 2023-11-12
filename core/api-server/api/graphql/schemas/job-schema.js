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
    data: DataWide 
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
type  Batch {
  taskId: String
  podName: String
  status: String
  batchIndex: Int
  startTime: String
  endTime: String
  output: Output
  input: [NodeInput]
}
  type NodeInput { path: String ,value : Object}


  type JobNodes { 
    nodeName: String
    algorithmName: String
    algorithmVersion: String
    taskId: String
    podName: String
    status: String
    startTime: Float
    stateType:String
    endTime: Float
    batchOperation:String
    ttl:Int
    kind:String
    level: Int
    batch: [Batch]
    batchInfo: BatchInfo
    boards: [String ]
    output: Output
    input: [NodeInput ] 
    minStatelessCount: Int
    maxStatelessCount: Int
    error:String
    warnings:[String]
    retries:Int
    downloadFileExt:String
    
  }

  type PipelineForJobNodes { 
      nodeName: String
      algorithmName: String
      input:[Object]
      kind: String
      stateType: String
  }

  type BatchInfo {
    idle: Int
    completed: Int
    errors: Int
    running: Int
    total: Int
  }

  type Value { types: [String ] metrics: Object}

  type Edges { from: String to: String value: Value }

  type Graph { jobId: String
    timestamp: Float
    nodes: [JobNodes ]
    edges: [Edges ] }

  type States { succeed: Int,failed:Int,stopped:Int,active:Int,creating:Int,preschedule:Int,pending:Int,skipped:Int,stalled:Int,warning:Int }

  type Data { progress: Float details: String states: States  }
  type DataWide { progress: Float details: String states: States storageInfo: StorageInfo }

  type Status { timestamp: Float
    status: String
    level: String
    pipeline: String
    data: Data }

  type LastRunResult { timestamp: String status: String timeTook: Float }



  type FlowInputMetadata { storageInfo: StorageInfo metadata: Metadata }

  type Cron { enabled: Boolean pattern: String }

  type Triggers { cron: Cron }

  type Options { batchTolerance: Int
    progressVerbosityLevel: String
    ttl: Int }

  type Files { link: String }

  type FlowInput { files: Files }

  type PipelineForJob { name: String
    experimentName: String
    kind: String
    priority: Int
    startTime: Float
    types: [String ]
    lastRunResult: LastRunResult
    flowInputMetadata: FlowInputMetadata
    triggers: Triggers
    options: Options
    flowInput: Object
    nodes: [PipelineForJobNodes ] 
}

  type UserPipeline { name: String
    experimentName: String
    kind: String
    priority: Int
    modified: String
    triggers: Triggers
    options: Options
    flowInput: Object
    nodes: [JobNodes ] 
    }

  type Job { key: String
    results: Results
    graph: Graph
    status: Status
    pipeline: PipelineForJob
    userPipeline: UserPipeline 
    cursor:String
    timeTook:String
    }

  type AggregatedJobs { 
    jobs:[Job]
    cursor:String
    jobsCount:Int 
    }


  extend type Query {
    jobsAggregated(experimentName:String, pipelineName:String, pipelineType:String, algorithmName:String, pipelineStatus:String,datesRange:Range,cursor:String,limit:Int): AggregatedJobs
    job(id: String!): Job
    jobsByExperimentName(experimentName: String!): [Job]
  }

  # Types with identical fields:
  # Green FlowInputfileslink

`;

module.exports = jobTypeDefs;
