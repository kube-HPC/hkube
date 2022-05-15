const { gql } = require('apollo-server');


const preferedTypeDefs = gql`

type ReturnList {
  jobId: String
  experimentName: String
  pipelineName: String
  priority: Int
  maxExceeded: Boolean
  entranceTime: Int
  tags: [String]
}

type ArrayReturnList {
  nextCount: Int
  prevCount: Int
  returnList: [ReturnList]
}


type AggragationPrefered {
  name: String
  count: Int
  lastJob: String
}

type AggragationManaged {
  name: String
  count: Int
}



extend type Query {
    preferedList(firstJobId: String,lastJobId:String,pageSize:Int!,pipelineName:String,tag:String,lastJobs:Boolean): ArrayReturnList
    managedList(firstJobId: String,lastJobId:String,pageSize:Int!,pipelineName:String,tag:String,lastJobs:Boolean): ArrayReturnList
    aggregatedTagsPrefered: [AggragationPrefered]
    aggregatedPipelinePrefered: [AggragationPrefered]
    aggregatedTagsManaged: [AggragationManaged]
    aggregatedPipelineManaged: [AggragationManaged]
 }

`;


module.exports = preferedTypeDefs;