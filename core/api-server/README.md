[![Build Status](https://travis-ci.org/kube-HPC/api-server.svg?branch=master)](https://travis-ci.org/kube-HPC/api-server)
[![Coverage Status](https://coveralls.io/repos/github/kube-HPC/api-server/badge.svg?branch=master)](https://coveralls.io/github/kube-HPC/api-server?branch=master)


![Diagram](/docs/images/api-server.png)

## Documentation

The full doc can be found [here](https://kube-hpc.github.io/api-server/docs.html)  
The Swagger-UI can found at http://localhost:3000/swagger-ui/

## Pipeline

The basic concept behind the Hkube pipeline is [DAG](https://en.wikipedia.org/wiki/Directed_acyclic_graph)  
Directed Acyclic Graph is a graph consisting of nodes connected with edges that have a direction: A -> B -> C

![Diagram](/docs/images/DAG.png)

### Example

Here we can see the most simple pipeline. We have three nodes: green, yellow and red.  
The green node will run first because it does not depend on any node.  
You can see the @ sign in the input of the green node. this sign indicates a refference to another node or flowInput.  
So the input of the green node will be: [['links-1', 'links-2', 'links-3'], false, "OK"].  
The next node to run will be the yellow node because it depend on the completion of the green node.  
See the "@green" in the input of the yellow node.  
So the input of the yellow node will be: [<Whatever green node returns>, true, 256].  
The last node to run will be the red node because it depend on the completion of green and yellow nodes.  
The input of the red node will be: [Whatever green node returns, Whatever yellow node returns].  

```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": ["@flowInput.files", false, "OK"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": ["@green", true, 256]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["@green", "@yellow"]
}],
"flowInput": {
    "files": ['links-1', 'links-2', 'links-3']
}
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/simple-pipeline.png)


### Example

This example is exactly like the first one, except one detail.  
You can notice for the input of the green node, it has the batch sign #.  

```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": ["#@flowInput.files"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": ["@green"]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["@yellow", "@green"]
}],
"flowInput": {
    "files": ['links-1', 'links-2', 'links-3']
}
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/batch-pipeline.png)

The green node will run as a batch becuase of the # sign in the input ("#@flowInput.files")  
The pipeline driver will create three different tasks from type green-alg, each with differrent input  

```js
worker 1: ["links-1"]
worker 2: ["links-2"]
worker 3: ["links-3"]
```


## License

  [MIT](LICENSE)
