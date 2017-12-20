[![Build Status](https://travis-ci.org/kube-HPC/api-server.svg?branch=master)](https://travis-ci.org/kube-HPC/api-server)
[![Coverage Status](https://coveralls.io/repos/github/kube-HPC/api-server/badge.svg?branch=master)](https://coveralls.io/github/kube-HPC/api-server?branch=master)


## Documentation

The full doc can be found [here](https://kube-hpc.github.io/api-server/docs.html)  
The Swagger-UI can found at http://localhost:3000/swagger-ui/

## Pipeline

The basic concept behind the Hkube pipeline is [DAG](https://en.wikipedia.org/wiki/Directed_acyclic_graph)  
Directed Acyclic Graph is a graph consisting of nodes connected with edges that have a direction: A -> B -> C

![Diagram](/docs/images/DAG.png)

The reasons for choosing this structure are:
- represent an orderings processing of nodes
- data flowing between the nodes
- parallel and batch processing

### Example

Here we can see the most basic pipeline

```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": [false, "OK"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": [true, "@green"]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["@yellow", 512]
}]
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/simple-pipeline.png)  

The blue circle is the pipeline driver which responsible for  
executing nodes with the right order and the right input.  
each result from any node is always return to the pipeline driver which  
decide what to next. Here we have three nodes: green, yellow and red.   
The green node -> pass it to yellow -> pass it to red.  
The input of one node is the output of another.  

The green node will run first because it does not depend on any other node.  
Green node input will be: [false, "OK", 256].  
Yellow node depends on green node, see the "@green" in the input of the yellow node.  
So the input of the yellow node will be: [true, green node output].  
The last node to run will be the red node because it depend on the completion of  
the yellow node. The input of the red node will be: [yellow node output, 512].  

The final results of this pipeline will be the output of the red node.  
That because the red node is the last node in the pipeline.

### Batch Example

You can also execute nodes in parallel and reduce the results into a single node.   
This example is exactly like the first one, except one detail.  
The batch sign: # in the input of the green node.  

```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": [false, "#[1,2,3]"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": [true, "@green"]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["@yellow", 512]
}]
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/simple-batch.png)

The green node will run as a batch because of the # sign in the input.  
This pipeline will create three different tasks from type green-alg,  
each with a different input:  

```js
task 1: [false, "1"]
task 2: [false, "2"]
task 3: [false, "3"]
```

The yellow node will wait until all tasks of the green node will finish.  
The input of the yellow node will be: [true, green node output].  
The input of the red node will be: [yellow node output, 512].

### Another Batch Example

You can also create a batch processing on node results.  
Lets say that green node returns an array: ['A', 'B', 'C'].


```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": [false, "OK"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": [false, "#@green"]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["@yellow", 512]
}]
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/batch-result.png)


## License

  [MIT](LICENSE)
