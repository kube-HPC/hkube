# ![HKube](https://user-images.githubusercontent.com/27515937/59049270-4cffa000-8890-11e9-8281-4aa97b1ecca3.png) <!-- omit in toc -->

> HKube is a cloud-native open source framework to run **[distributed](https://en.wikipedia.org/wiki/Distributed_computing) pipeline of algorithms** built on [Kubernetes](https://kubernetes.io/).
>
> HKube optimally **utilizing** pipeline's resources, based on **user priorities** and **[heuristics](https://en.wikipedia.org/wiki/Heuristic)**.

## Features <!-- omit in toc -->

- **Distributed pipeline of algorithms**

  - Receives [DAG graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph) as input and automatically parallelizes your algorithms over the cluster.
  - Manages the complications of distributed processing, keep your code simple (even single threaded).

- **Language Agnostic** - As a container based framework designed to facilitate the use of any language for your algorithm.

- **Batch Algorithms** - Run algorithms as a batch - instances of the same algorithm in order to accelerate the running time.

- **Optimize Hardware Utilization**

  - Containers **automatically** placed based on their resource requirements and other constraints, while not sacrificing availability.
  - Mixes critical and best-effort workloads in order to **drive up utilization** and save resources.
  - **Efficient execution** and clustering by heuristics which uses pipeline and algorithm metrics with combination of user requirements.

- **Build API** - Just upload your code, you **don't have to worry** about building containers and integrating them with HKube API.

- **Cluster Debugging**

  - Debug a **part of a pipeline** based on previous results.
  - Debug a **single algorithm** on your IDE, while the rest of the algorithms running in the cluster.

- **Jupyter Integration** - Scale your jupyter running tasks [Jupyter](https://jupyter.org/) with hkube.

## User Guide <!-- omit in toc -->

<!-- TOC -->

- [Installation](#installation)
  - [Dependencies](#dependencies)
  - [Helm](#helm)
- [APIs](#apis)
  - [UI Dashboard](#ui-dashboard)
  - [REST API](#rest-api)
  - [CLI](#cli)
- [API Usage Example](#api-usage-example)
  - [The Problem](#the-problem)
  - [Solution](#solution)
    - [Range Algorithm](#range-algorithm)
    - [Multiply Algorithm](#multiply-algorithm)
    - [Reduce Algorithm](#reduce-algorithm)
  - [Building a Pipeline](#building-a-pipeline)
    - [Pipeline Descriptor](#pipeline-descriptor)
    - [Node dependencies](#node-dependencies)
    - [JSON Breakdown](#json-breakdown)
    - [Advance Options](#advance-options)
  - [Algorithm](#algorithm)
    - [Implementing the Algorithms](#implementing-the-algorithms)
      - [Range (Python)](#range-python)
      - [Multiply (Python)](#multiply-python)
      - [Reduce (Javascript)](#reduce-javascript)
  - [Integrate Algorithms](#integrate-algorithms)
  - [Integrate Pipeline](#integrate-pipeline)
    - [Raw - Ad-hoc pipeline running](#raw---ad-hoc-pipeline-running)
    - [Stored - Storing the pipeline descriptor for next running](#stored---storing-the-pipeline-descriptor-for-next-running)
  - [Monitor Pipeline Results](#monitor-pipeline-results)

## Installation

### Dependencies

HKube runs on top of Kubernetes so in order to run HKube we have to install it's prerequisites.

- **Kubernetes** - Install [Kubernetes](https://kubernetes.io/docs/user-journeys/users/application-developer/foundational/#section-1) or [Minikube](https://kubernetes.io/docs/tasks/tools/install-minikube/) or [microk8s](https://microk8s.io/).

- **Helm** - HKube installation uses [Helm](https://helm.sh/), follow the [installation guide](https://helm.sh/docs/using_helm/#installing-helm).

### Helm

1. Add the [HKube Helm repository](http://hkube.io/helm/) to `helm`:

   ```bash
   helm repo add hkube http://hkube.io/helm/
   ```
2. Configure a docker registry for [builds](http://hkube.io/learn/algorithms/#the-easy-way)  
Create a ```values.yaml``` file for custom helm values
```yaml
build_secret:
# pull secret is only needed if docker hub is not accessible
  pull:
    registry: ''
    namespace: ''
    username: ''
    password: ''
# enter your docker hub / other registry credentials
  push:
    registry: '' # can be left empty for docker hub
    namespace: '' # registry namespace - usually your username
    username: ''
    password: ''
```

2. Install HKube chart

   ```console
   helm install hkube/hkube  -f ./values.yaml --name my-release
   ```

> This command installs HKube in a minimal configuration for **development**. Check [production-deployment](http://hkube.io/learn/install/#production-deployment).

## APIs

There are three ways to communicate with HKube: **Dashboard**, **REST API** and **CLI**.

### UI Dashboard

[Dashboard](http://hkube.io/tech/dashboard/) is a web-based HKube user interface. Dashboard supports every functionality HKube has to offer.

![ui](https://user-images.githubusercontent.com/27515937/59031674-051b5180-886d-11e9-9806-ecce2e3ba8f0.png)

### REST API

HKube exposes it's functionality with REST API.

- [API Spec](http://hkube.io/spec/)
- [Swagger-UI](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/kube-HPC/api-server/master/api/rest-api/swagger.json) - locally `{yourDomain}/hkube/api-server/swagger-ui`

### CLI

`hkubectl` is HKube command line tool.

```bash
hkubectl [type] [command] [name]

# More information
hkubectl --help
```

Download `hkubectl` [latest version](https://github.com/kube-HPC/hkubectl/releases).

```bash
curl -Lo hkubectl https://github.com/kube-HPC/hkubectl/releases/latest/download/hkubectl-linux \
&& chmod +x hkubectl \
&& sudo mv hkubectl /usr/local/bin/
```
> For mac replace with hkubectl-macos  
> For Windows download hkubectl-win.exe  

Config `hkubectl` with your running Kubernetes.

```bash
# Config
hkubectl config set endpoint ${KUBERNETES-MASTER-IP}

hkubectl config set rejectUnauthorized false
```

> Make sure `kubectl` is configured to your cluster.
>
> HKube requires that certain pods will run in privileged security permissions, consult your Kubernetes installation to see how it's done.

## API Usage Example

### The Problem

We want to solve the next problem with given input and a desired output:

- _Input:_ Two numbers `N`, `k`.
- _Desired Output:_ A number `M` so: <div style="text-align:center"><img src="https://latex.codecogs.com/svg.latex?M&space;=&space;\sum_{i=1}^N&space;k\cdot&space;i" title="M = \sum_{i=1}^N k\cdot i" /></div>

For example: `N=5`, `k=2` will result: <div style="text-align:center"><img src="https://latex.codecogs.com/svg.latex?2\cdot1&plus;2\cdot&space;2&space;&plus;&space;2\cdot&space;3&space;&plus;&space;2\cdot&space;4&space;&plus;&space;2\cdot&space;5&space;=&space;2&space;&plus;&space;4&space;&plus;6&plus;8&plus;10&space;=&space;30&space;=&space;M" title="2\cdot1+2\cdot 2 + 2\cdot 3 + 2\cdot 4 + 2\cdot 5 = 2 + 4 +6+8+10 = 30 = M" /></div>

### Solution

We will solve **the problem** by running a distributed pipeline of three algorithms: Range, Multiply and Reduce.

#### Range Algorithm

Creates an array of length `N`.

```console
 N = 5
 5 -> [1,2,3,4,5]
```

#### Multiply Algorithm

Multiples the received data from `Range Algorithm` by `k`.

```console
k = 2
[1,2,3,4,5] * (2) -> [2,4,6,8,10]
```

#### Reduce Algorithm

The algorithm will wait until all the instances of the `Multiply Algorithm` will finish then it will summarize the received data together .

```console
[2,4,6,8,10] -> 30
```

### Building a Pipeline

We will **implement the algorithms** using various languages and **construct a pipeline** from them using **HKube**.

![PipelineExample](https://user-images.githubusercontent.com/27515937/59348861-e9a6bf80-8d20-11e9-8d7b-76efedeb669f.png)

#### Pipeline Descriptor

The **pipeline descriptor** is a **JSON object** which describes and defines the links between the **nodes** by defining the dependencies between them.

```json
{
  "name": "numbers",
  "nodes": [
    {
      "nodeName": "Range",
      "algorithmName": "range",
      "input": ["@flowInput.data"]
    },
    {
      "nodeName": "Multiply",
      "algorithmName": "multiply",
      "input": ["#@Range", "@flowInput.mul"]
    },
    {
      "nodeName": "Reduce",
      "algorithmName": "reduce",
      "input": ["@Multiply"]
    }
  ],
  "flowInput": {
    "data": 5,
    "mul": 2
  }
}
```

> Note the `flowInput`: `data` = N = 5, `mul` = k = 2

#### Node dependencies

HKube [allows special signs](http://hkube.io/learn/execution/#batch) in nodes `input` for defining the pipeline execution flow.

In our case we used:

**(@)**  —  References input parameters for the algorithm.

**(#)**  —  Execute nodes in parallel and reduce the results into single node.

**(\#@)** — By combining `#` and `@` we can create a batch processing on node results.

![JSON](https://user-images.githubusercontent.com/27515937/59355883-815fda00-8d30-11e9-963c-c13b18caf54e.png)

#### JSON Breakdown

We created a pipeline name `numbers`.

```json
    "name":"numbers"
```

The pipeline is defined by three nodes.

```json
"nodes":[
    {
            "nodeName":"Range",
            "algorithmName":"range",
            "input":["@flowInput.data"]
        },
        {
            "nodeName":"Multiply",
            "algorithmName":"multiply",
            "input":["#@Range","@flowInput.mul"]
        },
        {
            "nodeName":"Reduce",
            "algorithmName":"reduce",
            "input":["@Multiply"]
        },
    ]
```

In HKube, the linkage between the nodes is done by defining the algorithm inputs. `Multiply` will be run after `Range` algorithm because of the input dependency between them.

Keep in mind that HKube will transport the results between the nodes **automatically** for doing it HKube currently support two different types of transportation layers _object storage_ and _files system_.

![Group 4 (3)](https://user-images.githubusercontent.com/27515937/59355963-a3595c80-8d30-11e9-88b0-96084085103e.png)

The `flowInput` is the place to define the Pipeline inputs:

```json
"flowInput":{
    "data":5,
    "mul":2
}
```

In our case we used _Numeric Type_ but it can be any [JSON type](https://json-schema.org/understanding-json-schema/reference/type.html) (`Object`, `String` etc).

#### Advance Options

There are more features that can be defined from the descriptor file.

```JSON
"webhooks": {
    "progress": "http://my-url-to-progress",
      "result": "http://my-url-to-result"
    },
  "priority": 3,
  "triggers":
      {
      "pipelines":[],
        "cron":{}
      }
  "options":{
      "batchTolerance": 80,
      "concurrentPipelines": 2,
      "ttl": 3600,
      "progressVerbosityLevel":"info"
  }
```

- **webhooks** - There are two types of webhooks, _progress_ and _result_.

  > You can also fetch the same data from the REST API.

  - progress:`{jobId}/api/v1/exec/status`
  - result: `{jobId}/api/v1/exec/results`

- **priority** - HKube support five level of priorities, five is the highest. Those priorities with the metrics that HKube gathered helps to decide which algorithms should be run first.

- **triggers** - There are two types of triggers that HKube currently support `cron` and `pipeline`.

  - **cron** - HKube can schedule your stored pipelines based on cron pattern.
    > Check [cron editor](https://crontab.guru/) in order to construct your cron.
  - **pipeline** - You can set your pipelines to run each time other pipeline/s has been finished successfully .

- **options** - There are other more options that can be configured:

  - **Batch Tolerance** - The Batch Tolerance is a threshold setting that allow you to control in which _percent_ from the batch processing the entire pipeline should be fail.
  - **Concurrency** - Pipeline Concurrency define the number of pipelines that are allowed to be running at the same time.
  - **TTL** - Time to live (TTL) limits the lifetime of pipeline in the cluster. stop will be sent if pipeline running for more than ttl (in seconds).
  - **Verbosity Level** - The Verbosity Level is a setting that allows to control what type of progress events the client will notified about. The severity levels are ascending from least important to most important: `trace` `debug` `info` `warn` `error` `critical`.

### Algorithm

The pipeline is built from algorithms which containerized with docker.

There are two ways to integrate your algorithm into HKube:

- **Seamless Integration** - As written above HKube can build automatically your docker with the HKube's websocket wrapper.
- **Code writing** - In order to add algorithm manually to HKube you need to wrap your algorithm with HKube. HKube already has a wrappers for `python`,`javaScript`, `java` and `.NET core`.

#### Implementing the [Algorithms](#meet-the-algorithms)

We will create the algorithms to solve [the problem](#the-problem), HKube currently support two languages for auto build _Python_ and _JavaScript_.

> Important notes:
>
> - **Installing dependencies**
>   During the container build, HKube will search for the _requirement.txt_ file and will try to install the packages from the pip package manager.
> - **Advanced Operations**
>   HKube can build the algorithm only by implementing start function but for advanced operation such as one time initiation and gracefully stopping you have to implement two other functions `init` and `stop`.

##### Range (Python)

```Python
def start(args):
    print('algorithm: range start')
    input = args['input'][0]
    array = list(range(input))
    return array
```

The start method calls with the args parameter, the inputs to the algorithm will appear in the `input` property.

The `input` property is an array, so you would like to take the first argument (`"input":["@flowInput.data"]` as you can see we placed `data` as the first argument)

##### Multiply (Python)

```Python
def start(args):
    print('algorithm: multiply start')
    input = args['input'][0]
    mul = args['input'][1]
    return input * mul
```

We sent two parameters `"input":["#@Range","@flowInput.mul"]`, the first one is the output from `Range` that sent an array of numbers, but because we using **batch** sign **(#)** each multiply algorithm will get one item from the array, the second parameter we passing is the `mul` parameter from the `flowInput` object.

##### Reduce (Javascript)

```javascript
module.exports.start = args => {
  console.log('algorithm: reduce start');
  const input = args.input[0];
  return input.reduce((acc, cur) => acc + cur);
};
```

We placed `["@Multiply"]` in the input parameter, HKube will collect all the data from the multiply algorithm and will sent it as an array in the first input parameter.

### Integrate Algorithms

After we created the [algorithms](#meet-the-algorithms), we will integrate them with the [CLI](#cli).

> Can be done also through the [Dashboard](#dashboard).

Create a `yaml` (or `JSON`) that defines the **algorithm**:

```yaml
# range.yml
name: range
env: python # can be python or javascript
resources:
  cpu: 0.5
  gpu: 1 # if not needed just remove it from the file
  mem: 512Mi

code:
  path: /path-to-algorithm/range.tar.gz
  entryPoint: main.py
```

Add it with the [CLI](#cli):

```console
hkubectl algorithm apply --f range.yml
```

> Keep in mind we have to do it **for each one of the algorithms**.

### Integrate Pipeline

Create a `yaml` (or `JSON`) that defines the **pipeline**:

```yml
# number.yml
name: numbers
nodes:
  - nodeName: Range
    algorithmName: range
    input:
      - '@flowInput.data'
  - nodeName: Multiply
    algorithmName: multiply
    input:
      - '#@Range'
      - '@flowInput.mul'
  - nodeName: Reduce
    algorithmName: reduce
    input:
      - '@Multiply'
flowInput:
  data: 5
  mul: 2
```

#### Raw - Ad-hoc pipeline running

For running our pipeline as raw-data:

```bash
hkubectl exec raw --f numbers.yml
```

#### Stored - Storing the pipeline descriptor for next running

First we store the pipeline:

```bash
hkubectl pipeline store --f numbers.yml
```

Then you can execute it (if `flowInput` available)

```bash
# flowInput stored
hkubectl exec stored numbers
```

For executing the pipeline with other input, create `yaml` (or `JSON`) file with `flowInput` key:

```yml
# otherFlowInput.yml
flowInput:
  data: 500
  mul: 200
```

Then you can executed it by pipeline `name`:

```bash
# Executes pipeline "numbers" with data=500, mul=200
hkubectl exec stored numbers --f otherFlowInput.yml
```

### Monitor Pipeline Results

As a result of executing pipeline, HKube will return a `jobId`.

```bash
# Job ID returned after execution.
result:
  jobId: numbers:a56c97cb-5d62-4990-817c-04a8b0448b7c.numbers
```

This is a unique identifier helps to **query** this **specific pipeline execution**.

- **Stop** pipeline execution:
  `hkubectl exec stop <jobId> [reason]`

- **Track** pipeline status:
  `hkubectl exec status <jobId>`

- **Track** pipeline result:
  `hkubectl exec result <jobId>`

