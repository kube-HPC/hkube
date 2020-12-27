[![Build Status](https://travis-ci.org/kube-HPC/pipeline-driver.svg?branch=master)](https://travis-ci.org/kube-HPC/pipeline-driver)
[![Coverage Status](https://coveralls.io/repos/github/kube-HPC/pipeline-driver/badge.svg?branch=master)](https://coveralls.io/github/kube-HPC/pipeline-driver?branch=master)


![Diagram](/docs/images/pipeline-driver.png)

## Documentation

The pipeline-driver based on the producer-consumer pattern.  
Each pipeline-driver can only process a single job at a time.
First the task runner consumes a job, then it goes as follows:

1. get the execution pipeline from etcd.
2. create directed graph from the nodes array.
3. check if this job should be recovered.
4. find the entry nodes in graph and start the pipeline.
5. for each node parse the input and create single or batch tasks.
6. save each task in etcd and then create new job.
7. for each task update it's state (waiting/active/completed/failed).
8. then update the progress of the task in etcd.
9. decide if to run the next task in the pipeline.
10. if one node failed, the entire pipeline will failed.
11. unless this node is part of a batch and the batch tolerance lower the total failed.

