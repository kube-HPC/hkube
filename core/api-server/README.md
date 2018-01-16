[![Build Status](https://travis-ci.org/kube-HPC/api-server.svg?branch=master)](https://travis-ci.org/kube-HPC/api-server)
[![Coverage Status](https://coveralls.io/repos/github/kube-HPC/api-server/badge.svg?branch=master)](https://coveralls.io/github/kube-HPC/api-server?branch=master)


## Documentation

The full doc can be found [here](https://kube-hpc.github.io/api-server/docs.html)  
The Swagger-UI can found at http://localhost:3000/swagger-ui/


# Table of Contents

* [Pipeline](#pipeline)
* [Nodes](#nodes)
  * [Entry Nodes](#entry-nodes)
  * [Final Nodes](#final-nodes)
* [Input](#input)
  * [Input Types](#input-types)
  * [Input Order](#input-order)
* [Execution Flow](#execution-flow)
  * [Flow Input](#flow-input)
  * [Reference](#reference)
  * [Batch](#Batch)
  * [Batch Reference](#batch-reference)
  * [Wait Any](#wait-any)
* [Webhooks](#webhooks)
  * [Progress](#progress)
    * [Verbosity Level](#verbosity-level)
  * [Result](#result)
  

## Pipeline

The basic concept behind the Hkube pipeline is [DAG](https://en.wikipedia.org/wiki/Directed_acyclic_graph)  
Directed Acyclic Graph is a graph consisting of nodes connected with edges that have a direction: A -> B -> C.  

The reasons for choosing this structure are:
- Represent an orderings processing of nodes
- Data flow between the nodes
- Parallel and batch processing

## Nodes

![Diagram](/docs/images/DAG.png)

In order to create this pipeline flow, we need to specify  
a node list which look like this:  

```js
"nodes": [{
    "nodeName": "A",
    "algorithmName": "a-alg",
    "input": ["data"]
},
{
    "nodeName": "B",
    "algorithmName": "b-alg",
    "input": ["@A"]
},
{
    "nodeName": "C",
    "algorithmName": "c-alg",
    "input": ["@B"]
},
{
    "nodeName": "D",
    "algorithmName": "d-alg",
    "input": ["@B", "@G"]
},
{
    "nodeName": "E",
    "algorithmName": "e-alg",
    "input": ["@B", "@C", "@D"]
},
{
    "nodeName": "F",
    "algorithmName": "f-alg",
    "input": ["@E"]
},
{
    "nodeName": "G",
    "algorithmName": "g-alg",
    "input": ["data"]
}]
```

*The order of the nodes in this list is not relevant*

Each node has three properties.  
- **nodeName**: the node unique identifier in the current pipeline. 
- **algorithmName**: the name of the algorithm that should run.
- **input**: the input to the algorithm.

Node A and Node G will run first in parallel, because their input does not refer  
to any other node. The **@** indicates a reference to other node.  

Node B will run after Node A (["@A"])
Node C will run after Node B (["@B"])
Node D will run after Node B and G (["@B", "@G"])
Node E will run after Node B, C, D (["@B", "@C", "@D"])
Node F will run after Node E (["@E"])

You can see that the order and the direction of the  
pipeline is determined by the node **input**.

### Entry Nodes

These are the nodes that will run first, in the example above Node A and Node G.   
Their input does not refer to any other node (have no parents).

### Final Nodes

These are the nodes that will run last, in the example above Node F.   
No other node is depend on these nodes (have no children).
Tge results of the pipeline is determined by these nodes.

## Input

The node input can accept as many arguments as you want from any type:  
Number, Boolean, String, Null and JSON Object.

```js
"nodes": [{
    "nodeName": "example",
    "algorithmName": "example-alg",
    "input": [42, 42.56, -512.23, false, true, "OK", null, {foo: "bar"}]
}]
```

### Input Order

Take a look at the input of **Node E**: ["@B", "@C", "@D"].  
The order of the arguments is not important here, it also can be ["@D", "@C", "@B"].  
The order is only important for the algorithm signature.

## Execution Flow

Beside these data types, there are special signs that designed  
to define the pipeline execution flow.

- (@)  - [Reference](#Reference)
- (#)  - [Batch](#Batch)
- (#@) - [Batch Reference](#Batch Reference)
- (*@) - [Wait Any](#Wait Any)

### Flow Input

You can define reusable data for nodes input, this input is an object that called **flowInput**.  
Using the @ sign we can easily refer to this object.

```js
"nodes": [{
    "nodeName": "example",
    "algorithmName": "example-alg",
    "input": [42, true, "@flowInput.files.links", null, {foo: "bar"}]
}],
"flowInput": {
    "files": {
        "links": [
            "links-1",
            "links-2",
            "links-3"
        ]}
}
```

Now the example algorithm will run with this input:

```js
example-alg: [42, true, ["links-1","links-2","links-3"], null, {foo: "bar"}]
```

Or batch

```js
"nodes": [{
    "nodeName": "example",
    "algorithmName": "example-alg",
    "input": [42, false, true, "#@flowInput.files.links", null, {foo: "bar"}]
}],
"flowInput": {
    "files": {
        "links": [
            "links-1",
            "links-2",
            "links-3"
        ]}
}
```

Now the example algorithm will run with this input:

```js
example-alg 1: [42, true, ["links-1"], null, {foo: "bar"}]
example-alg 2: [42, true, ["links-2"], null, {foo: "bar"}]
example-alg 3: [42, true, ["links-3"], null, {foo: "bar"}]
```

### Reference

As we can see in the A -> B -> C pipeline example, by using @ in the input  
we can take node output and make it the input of another node.

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


The blue circle is the **pipeline driver** which responsible for  
executing nodes with the right order and the right input.  
Each result from any node is always return to the pipeline driver which decide what to do next.  

The green node will run first because it does not depend on any other node.  
Green node input will be: [false, "OK"].  
Yellow node depends on green node, see the "@green" in the input of the yellow node.  
So the input of the yellow node will be: [true, **green node output**].  
The last node to run will be the red node because it depend on the completion of  
the yellow node. The input of the red node will be: [**yellow node output**, 512].  

The final results of this pipeline will be the output of the red node.  
That because the red node is the last node in the pipeline.

### Batch

By using # in the input we can execute nodes in parallel and reduce the results into a single node.   
This example is exactly like the first one, except the # sign in the input of the green node.

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
This pipeline will create three different tasks from type green-alg.  
each with a different input:  

```js
green-alg 1: [false, "1"]
green-alg 2: [false, "2"]
green-alg 3: [false, "3"]
```

The yellow node will wait until all tasks of the green node will finish.  
The input of the yellow node will be: [true, green node output].  
The input of the red node will be: [yellow node output, 512].

## Batch Tolerance

The Batch Tolerance is a threshold setting that allow to  
control in which **percent** the entire pipeline should be failed.  
In this example the pipeline will failed if 3/5 from green node batch items has failed. 

```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": ["#[1,2,3,4,5]"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": ["@green"]
}],
"options": {
    "batchTolerance": 60
}
```

### Batch Reference

By using #@ in the input we can create a batch processing on node results.  
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

**Node yellow** will run three times, each with a different input.

```js
yellow-alg 1: [false, "A"]
yellow-alg 2: [false, "B"]
yellow-alg 3: [false, "C"]
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/batch-result.png)


### Wait Any

By using *@ in the input we can create a wait any on batch.

```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": [10, "#[1,2,3]"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": [true, "*@green"]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["@yellow", 512]
}]
```

The green node is defined to run as batch "#[1,2,3]".

```js
green-alg 1: [10, 1] -> 11
green-alg 2: [10, 2] -> 12
green-alg 3: [10, 3] -> 13
``` 

The first argument is 10 and the second is one number from the batch array.  
For each run it's return the sum of these two numbers.

Now what if we don't want that **Node yellow** will wait until all the batch processing is done?  
We can define in the node input to wait for any result of green, like this: "*@green".  
This way **Node yellow** will run three times, each with different input from **Node green** output.

```js
yellow-alg 1: [true, 11]
yellow-alg 2: [true, 12]
yellow-alg 3: [true, 13]
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/wait-any.png)  


### More Batch Example

```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": [10, "#[1,2,3]"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": [true, "*@green"]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["@yellow", 512]
}]
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/wait-any.png) 



### Another Wait Any

What if we want to run multiple batches, and for each batch item result  
We want to run node that will accept results with same order they have been created.


```js
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": ["#[1,2,3]", "OK"]
},
{
    "nodeName": "yellow",
    "algorithmName": "yellow-alg",
    "input": ["#[1,2,3]", "OK"]
},
{
    "nodeName": "red",
    "algorithmName": "red-alg",
    "input": ["*@green", "*@yellow"]
}]
```

In this example the **Node red** will run with the correct tuples.
This is default behavior of the system.

```js
red-alg 1: [1, 1]
red-alg 2: [2, 2]
red-alg 3: [3, 3]
```

The DAG of this pipeline will look like:  
![Diagram](/docs/images/double-wait-any.png) 

## Webhooks

The WebHooks are an HTTP callbacks, the system can send request to the client  
when something happens. consider it like a push notifications.  
There are two types of webhooks, progress and result.  

You can also fetch the same data from the API:
* progress - /api/v1/exec/status
* result   - /api/v1/exec/results

Webhooks headers are:
Method: POST  
Content-type: application/json

*The webhooks are optional*

### Progress

The purpose of the progress webhook is to update the client  
when the state of the pipeline is changed.

```js
"name": "batch",
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": ["#[1,2,3]"]
}],
"webhooks": {
    "progress": "http://<URL>",
    "result": "http://<URL>"
}
```

And this is the progress webhook payload

```js
{
    "jobId": "batch:672a8b0e-c0b0-486e-bb2b-4571b0805f29",
    "timestamp": "2018-01-16T14:47:04.142Z",
    "pipeline": "batch",
    "data": {
        "level": "info",
        "status": "completed",
        "progress": "100.00",
        "details": "100.00% completed, 3 succeed"
    }
}
```

### Verbosity Level

The Verbosity Level is a setting that allow to control what type of  
progress events the client will notified about.  
The severity levels are ascending from least important to most important.
* silly
* debug
* info
* warning
* error
* critical

If the client specified **debug** level, every progress from debug  
level and above will be sent to the client.

```js
"name": "batch",
"nodes": [{
    "nodeName": "green",
    "algorithmName": "green-alg",
    "input": ["#[1,2,3,4,5,6,7,8,9,10]"]
}],
"webhooks": {
    "progress": "http://<URL>",
    "result": "http://<URL>"
},
"options": {
    "progressVerbosityLevel": "debug"
}
```

And this is the progress webhook payload

```js
{
    "jobId": "batch:0358b42d-e0c0-4ce8-ae9a-466f02841d87",
    "timestamp": "2018-01-16T14:27:16.056Z",
    "pipeline": "batch",
    "data": {
        "level": "debug",
        "status": "active",
        "progress": "33.33",
        "details": "33.33% completed, 4 succeed, 2 active, 4 pending, 2 creating",
        "activeNodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "batch": {
                    "active": 6,
                    "total": 10
                }
            }
        ]
    }
}

```

### Result

The purpose of the result webhook is to update the client  
when the pipeline is completed.

This is the result webhook payload

```js
{
    "jobId": "simple:e51c8dd7-7a7b-4d65-ad36-d1a919a9dee1",
    "timestamp": "2018-01-16T15:15:00.369Z",
    "pipeline": "simple",
    "data": {
        "result": [
            {
                "nodeName": "black",
                "algorithmName": "black-alg",
                "result": "links-1"
            }
        ],
        "status": "completed"
    }
}
```

## License

  [MIT](LICENSE)
