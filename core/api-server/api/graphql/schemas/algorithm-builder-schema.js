const { gql } = require('apollo-server');


const algorithmBuildsTypeDefs = gql`
type Result { data: String warnings: String errors: String }

type Commit { id: String timestamp: String message: String }

type GitRepository { gitKind: String
  url: String
  branchName: String
  webUrl: String
  cloneUrl: String
  commit: Commit }

type Options { debug: Boolean pending: Boolean }

type Algorithm { name: String
  cpu: Float
  gpu: Float
  mem: String
  reservedMemory: String
  minHotWorkers: Int
  env: String
  entryPoint: String
  type: String
  options: Options
  gitRepository: GitRepository }


"algorithmBuilds is a list of AlgorithmBuilds"
type AlgorithmBuild {
    "algorithmBuilds is a list of AlgorithmBuilds"
     buildId: String
  imageTag: String
  env: String
  algorithmName: String
  type: String
  status: String
  progress: Int
  error: String
  trace: String
  endTime: Float
  startTime: Float
  timestamp: Float
  algorithmImage: String
  buildMode: String
  result: Result
  gitRepository: GitRepository
  algorithm: Algorithm
 }

 extend type Query {
    algorithmBuilds(algorithmName:String!):[AlgorithmBuild]

 }
 `


module.exports = algorithmBuildsTypeDefs;