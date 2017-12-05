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

```js

"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": ["some string", false, "#@flowInput.files1", 980]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": ["@green", "@green.data.result", {"custom": "@flowInput.files1"}]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["@yellow", "@green.data.result"]
}],
"flowInput": {
    "file": 'links-1',
    "files1": ['links-1', 'links-2', 'links-3'],
    "files2": ['links-4', 'links-5', 'links-6']
}

nodeName: 'String, Unique'
algorithmName: 'String'
input: 'Array'

```

The input of the node indicates how the pipeline will work
these symbols can be used:

- @  - reffer to <node> or <flowInput>
- #@ - run as batch on <node> or <flowInput>
- *# - for each run as batch
- *@ - for each reffer to another node output

In the example above, yellow node is depend on green node, you can see it in yellow input.  
green node run as a batch becuase of the # sign,   
and the batch is on flowInput.files1 (['links-1', 'links-2', 'links-3'])  
This will create 3 workers with 3 differrent inputs:  

```js
worker 1: ["some string", false, "links-1" , 980]
worker 2: ["some string", false, "links-2" , 980]
worker 3: ["some string", false, "links-3" , 980]

```

Note that the batch sign # is at index 2, so wach value of flowInput.files1 will be also at index 2  
In this example each worker will return a result  
So the output of green node batch is an array of 3 result:  
```js
[
        {"data": "result": "green-1-result"},
        {"data": "result": "green-2-result"},
        {"data": "result": "green-3-result"}
]
```
when green node completes its job, yellow node will start.  
You can see that yellow node needs the green node results, the inner results, and flowInput.files1  
So the input of yellow node will look like this:  
```js
[
    [
        {"data": "result": "green-1-result"},
        {"data": "result": "green-2-result"},
        {"data": "result": "green-3-result"}
    ],
    [
        "green-1-result",
        "green-2-result",
        "green-3-result"
    ],
    [
        {"custom": 'links-1'}, 
        {"custom": 'links-2'}, 
        {"custom":'links-3'}
    ]
]

```
When yellow node completes its job, red node will start.  
The output of the yellow node is for example {"data":{"result":"yellow-result"}}
Red node run as a batch becuase of the # sign and the batch is on the yellow node ([3,7,9]).  
This will create 3 workers with 3 differrent inputs: 
```js

[
   [{"data":{"result": "yellow-result"}}],
   ["green-1-result","green-2-result", "green-3-result"]
]


```
