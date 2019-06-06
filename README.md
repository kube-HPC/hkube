# ![BannerGithubSimulator](https://user-images.githubusercontent.com/27515937/59049270-4cffa000-8890-11e9-8281-4aa97b1ecca3.png)

> HKube is a cloud-native open source framework to run distributed pipeline of algorithms built on Kubernetes. HKube allows running pipelines of algorithms on Kubernetes cluster optimally utilizing the available resources, based on user priorities and AI heuristics.

## Features

**Distributed pipeline of algorithms** - HKube receives input DAG graph and automatically parallelizes your algorithms(nodes) over the cluster. you can keep your code simple (even single threaded) and let HKube worry about the complications of distributed processing.

**Language Agnostic** - HKube is a container based framework and designed to facilitate the use of any language for your algorithm

**Batch algorithms**  -  With HKube you can run algorithms as a batch, multiple instances of the same algorithm in order to accelerate the running of this specific algorithm

**Optimize Hardware utilization** - HKube Automatically places containers based on their resource requirements and other constraints, while not sacrificing availability. Mix critical and best-effort workloads in order to drive up utilization and save even more resources. HKube has metrics and AI engines that help learn about your algorithm (like run-time, cpu usage, priority ..) to make efficient execution and clustering.

**Build API** -   With HKube you can just upload your code you don't have to worry about to build containers and how to integrate with HKube API (of course you can do it if you like) The automatic builder feature will do it all for you.

**Debugging**-   Struggling on debugging your algorithm across the cluster HKube makes this process really easy. this process can be done by running your algorithm on your pc on your IDE while the other algorithms run on the cluster. you can also run part of the pipeline with the results from the previous running which will make the debugging much faster

**Jupiter Integration** - HKube has integration with jupiter so you able to scale  your running on top HKube via jupiter


## Installation

### Prerequisite

HKube runs on top of Kubernetes so in order to run HKube we have to install it's prerequisites.

1. **Kubernetes** - Install  [Kubernetes](https://kubernetes.io/docs/user-journeys/users/application-developer/foundational/#section-1)  or  [Minikube](https://kubernetes.io/docs/tasks/tools/install-minikube/)  or  [microk8s](https://microk8s.io/)

    > Make sure kubectl is configured to your cluster.
    > For collecting algorithm logs, and to create builds, HKube requires that certain pods will run in privileged security permissions. Consult your kubernetes installation to see how to do that.
2. **Helm** -  HKube installation uses helm for more information about how to install it follow this guide [helm installation](https://helm.sh/docs/using_helm/#installing-helm).

### Install

1. **Add  HKube helm repository** -  The chart is hosted in [http://hkube.io/helm/](http://hkube.io/helm/) To add the repo to your helm run:

    ```console
    helm repo add HKube http://hkube.io/helm/
    ```

2. **Install HKube chart** -  To install the chart with the release name `release name`:

    ```console
    helm install HKube/HKube --name my-release
    ```

    >This command installs `HKube` in a minimal configuration for development. For production installation follow the link here [production-deployment](http://hkube.io/learn/install/#production-deployment).

## APIs

There are three ways communicating with HKube, **REST**, **CLI** and **HKube Dashboard**.

### REST

HKube exposes it's functionality with REST.

> It is a good place to say that the CLI and the UI using the REST api for all of the operations so you probably can do anything  from the REST api without using any other tool.

- [HKube API Spec](http://hkube.io/spec/)
- [Swagger-UI](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/kube-HPC/api-server/master/api/rest-api/swagger.json)
  - Locally visit `{yourDomain}/HKube/api-server/swagger-ui`

### CLI

`hkubectl`  is a command-line tool that help you to work with HKube more easily.

#### Syntax:

```console
hkubectl [type] [command] [name]
```

use `hkubectl --help` for more information

```bash
# Download
curl -L https://github.com/kube-HPC/HKubectl/releases/download/v1.1.7/HKubectl.tgz | tar xvz
sudo cp ./hkubectl /usr/local/bin

# Config
hkubectl config set endpoint <KUBERNETES-MASTER-IP>/HKube/api-server/

hkubectl config set rejectUnauthorized false
```

### UI

HKube has a rich [UI Dashboard](http://hkube.io/tech/dashboard/) which supports every functionality HKube has to offer and even more.

![ui](https://user-images.githubusercontent.com/27515937/59031674-051b5180-886d-11e9-9806-ecce2e3ba8f0.png )

## API Usage Example

After we got familiar with HKube **features** and **APIs**
lets create our first pipeline.

### The Problem

We want to solve the next problem with given input and a desired output:

- *Input:* Two numbers `N`, `k`.
- *Desired Output:* A number `M` so:

$$M = \sum_{i=1}^N k\cdot i$$

> Example: `N=3`, `k=5` will result:
> $$ 2\cdot1+2\cdot 2 + 2\cdot 3 + 2\cdot 4 + 2\cdot 5 = 2 + 4 +6+8+10 = 30 = M$$

### Solution

We will solve **the problem** by running a distributed pipeline of three algorithms: Range, Multiply and Aggregate.

We will **implement the algorithms** using various languages and **construct a pipeline** from them using **HKube**.

#### Meet the Algorithms

1. **Range Algorithm:** Creates an array of length `N`.

    ```console
     N = 5
     5 -> [1,2,3,4,5]
    ```

2. **Multiply Algorithm:** Multiples the received data from `Range Algorithm` by `M`.

    ```console
    M = 2
    [1,2,3,4,5] * (2) -> [2,4,6,8,10]
    ```

3. **Aggregate Algorithm**: The algorithm will wait until all the instances of the `Multiply Algorithm` will finish then it will summarize the received data together .

    ```console
    [2,4,6,8,10] -> 30
    ```

![PipelineExample](https://user-images.githubusercontent.com/27515937/59054539-95bd5600-889c-11e9-9356-778df69ce31b.png)

#### Pipeline Descriptor

HKube Supports two kinds of APIs for creating pipeline:  **JSON** and **Code**.

##### JSON

The **pipeline descriptor** is a **JSON object** which describes and defines the links between the **nodes** by defining the  dependencies between them.

```json
{
    "name":"numbers",
    "nodes":[
    {
            "nodeName":"Range",
            "algorithmName":"range-algorithm",
            "input":["@flowInput.data"]
        },
        {
            "nodeName":"Multiply",
            "algorithmName":"multiply-algorithm",
            "input":["#@Range","@flowInput.mul"]
        },
        {
            "nodeName":"Aggregate",
            "algorithmName":"aggregate-algorithm",
            "input":["@Multiply"]
        },
    ],
    "flowInput":{
        "data":5,
        "mul":2
    }
}
```

> Note the `flowInput`:
> $$ data = N = 5,mul = M = 2$$

###### Node dependencies

HKube [allows special signs](http://hkube.io/learn/execution/#batch) in nodes `input` for defining the pipeline execution flow.

In our case we used:

**(@)**  —  References input parameters for the algorithm.

**(#)**  —  Execute nodes in parallel and reduce the results into single node.

**(\#@)** — By combining `#` and `@` we can create a batch processing on node results.

![JSON](https://user-images.githubusercontent.com/27515937/59057613-665e1780-88a3-11e9-92d1-ee44ac96b049.png)

###### JSON Breakout

We created a pipeline name `numbers`.

```json
    "name":"numbers"
```

The pipeline is defined by three nodes.

```json
"nodes":[
    {
            "nodeName":"Range",
            "algorithmName":"range-algorithm",
            "input":["@flowInput.data"]
        },
        {
            "nodeName":"Multiply",
            "algorithmName":"multiply-algorithm",
            "input":["#@Range","@flowInput.mul"]
        },
        {
            "nodeName":"Aggregate",
            "algorithmName":"aggregate-algorithm",
            "input":["@Multiply"]
        },
    ]
```

In HKube, the linkage between the nodes is done by defining the algorithm inputs. `Multiply` will be run after `Range` algorithm because of the input dependency between them.

Keep in mind that HKube will transport the results between the nodes **automatically** for doing it HKube currently support two different types of transportation layers *object storage* and *files system*.

![HKube Pipeline](https://user-images.githubusercontent.com/27515937/59057623-6e1dbc00-88a3-11e9-9f92-50fc6b1d2bb8.png)

The `flowInput` is the place to define the Pipeline inputs.

```json
"flowInput":{
    "data":5,
    "mul":2
}
```

In our case we used [JSON Numeric Type](https://json-schema.org/understanding-json-schema/reference/numeric.html#numeric-types) but it can be **anything**.

##### More JSON Options (For advanced use cases)

Theres a lot of great more features that can be define from the descriptor file.

```JSON
 "webhooks": {
      "progress": "[http://my-url-to-progress](http://my-url-to-progress/)",
       "result": "[http://my-url-to-result](http://my-url-to-result/)"
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

**webhooks** - HKube has a REST api for getting the results but it support **webhooks** as well.
There are two types of webhooks, *progress* and *result*. You can also fetch the same data from the REST API.

- progress:`{jobId}/api/v1/exec/status`
- result: `{jobId}/api/v1/exec/results`

**priority**  -  HKube support five level of priorities, five is the highest. Those priorities with the metrics that HKube gathered helps to decide which algorithms should be run first.

**triggers** - There are two types of triggers that HKube currently support `cron` and `pipeline`.

- **cron** - HKube can schedule your stored pipelines based on cron pattern.
    > Check [cron editor](https://crontab.guru/) in order to construct your cron.
- **pipeline** - You can set your pipelines to run each time other pipeline/s has been finished successfully .

 **options** - There are other more options that can be configured:

- **Batch Tolerance** -  The Batch Tolerance is a threshold setting that allow you to control in which *percent* from the batch processing the entire pipeline should be fail.
- **Concurrency** - Pipeline Concurrency define the number of pipelines that are allowed to be running at the same time.
- **TTL** - Time to live (TTL) limits the lifetime of pipeline in the cluster. stop will be sent if pipeline running for more than ttl (in seconds).
- **Verbosity Level** -  The Verbosity Level is a setting that allows to control what type of progress events the client will notified about. The severity levels are ascending from least important to most important: `trace`  `debug`  `info`  `warn`  `error`  `critical`.

#### Algorithm

The pipeline is built from algorithms which containerized with docker.

There are two ways to integrate your algorithm into HKube:

- **Seamless Integration** - As written above HKube can build automatically your docker with the HKube's websocket wrapper.
- **Code writing** -  In order to add algorithm manually to HKube you need to wrap your algorithm with HKube. HKube already has a wrappers for `python`,`javaScript`, `java` and `.NET core`.

##### Seamless Integration

Now lets create the algorithms to solve [the problem](#the-problem), HKube currently support two languages for auto build *Python* and *JavaScript*.

> Important notes:
>
> - **Installing dependencies**
 During the container build, HKube will search for the *requirement.txt* file and will try to install the packages from the pip package manager.
> - **Advanced Operations**
 HKube can build the algorithm only by implementing start function but for advanced operation such as one time initiation and gracefully stopping you have to implement two other functions `init` and `stop`.

##### Creating the [algorithms](#meet-the-algorithms)

- **Range** - For the `range` algorithm we will use *Python*.

```Python
def  start(args):
    print('algorithm: range start')
    input  = args['input'][0]
    array =  range(input);
    return array
```

The start method calls with the args parameter, the inputs to the algorithm will appear in the `input` property.

The ``input`` property is an array, so you would like to take the first argument (`"input":["@flowInput.data"]` as you can see we placed `data` as the first argument)

- **Multiply** - For the `multiply` algorithm we will use *Python*:

```Python
def  start(args):
    print('algorithm: multiply start')
    input  = args['input'][0];
    mul  = args['input'][1];
    return input * mul
```

 Lets remind the inputs that we write in the descriptor:

```JSON
 "input":["#@Add","@flowInput.mul"]
```

We sent two parameters, the first one is the output from `Range` that sent an array of numbers, but because we using **batch** sign **(#)** each multiply algorithm will get one item from the array, the second parameter we passing is the `mul` parameter from the `flowInput` object.

- **Aggregate** - For the `aggregate` algorithm we will use *Javascript*:

```javascript
module.exports.start = (args) => {
    const input = args.input[0];
    return input.reduce(acc, curr) => acc + curr;
}
```

We placed `["@Multiply"]` in the input parameter, HKube will collect all the data from the multiply algorithm and will sent it as an array in the first input parameter.

After we created the algorithms, all we have to do is to integrate them with HKube, for this tutorial we will use HKube's CLI api but pretty much every operation can be done from HKube's [Dashboard](http://hkube.io/tech/dashboard/).

For doing it we need to create a yaml (or json) that defines the algorithms (we will demonstrate the first but its pretty much the same operation to all of them).

```yaml
name: range
#env can be python or javascript
env: python
# if gpu is not needed just remove it from the file
resources:
   cpu: 0.5
#  gpu: 1
   mem: 512Mi

code:
   path: /path-to-algorithm/range.tar.gz
   entryPoint: main.py
```

To add it from the CLI we will use:

```console
hkubectl algorithm apply --f algorithmName.yml
```

> Keep in mind we have to do it for all the algorithms.

```yaml
name: numbers
nodes:
- nodeName: Range
  algorithmName: range-algorithm
  input:
  - "@flowInput.data"
- nodeName: Multiply
  algorithmName: multiply-algorithm
  input:
  - "#@Range"
  - "@flowInput.mul"
- nodeName: Aggregate
  algorithmName: aggregate-algorithm
  input:
  - "@Multiply"
  flowInput:
     data:5
     mul:2
```

There are two methods to integrate pipeline with HKube:

- **Raw** -  Ad-hoc pipeline running.
- **Stored** - Storing the pipeline descriptor for next running.

For running our pipeline as raw we will use:

```console
hkubectl pipeline exec raw --f numbers.yml
```

To store the pipeline we will have to create two different steps:

1. For storing the pipeline:

    ```console
    hkubectl pipeline store --f numbers.yml
    ```

2. For executed the pipeline:

    ```console
    hkubectl pipeline exec stored numbers --f flowInput.yaml
    ```

```yaml
flowInput:
    data:5
    mul:2
```

As a result of executing pipeline, HKube will return a `jobId`.
This is a unique identifier which helps to query this specific pipeline execution.

- You can stop the pipeline:
 `hkubectl exec stop <jobId> [reason]`

- You can track the pipeline status:
 `hkubectl exec status <jobId>`

- You can track the result:
 `hkubectl exec result <jobId>`
