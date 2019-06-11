
  

![BannerGithub](https://user-images.githubusercontent.com/27515937/59034366-94c3fe80-8873-11e9-9f9d-c991c632a9e8.png)

# Welcome to HKUBE

Hkube is a cloud-native open source framework to run distributed pipeline of algorithms built on Kubernetes. Hkube allows running pipelines of algorithms on Kubernetes cluster optimally utilizing the available resources, based on user priorities and AI heuristics.


# Features 

 **Distributed pipeline of algorithms** - Hkube receives input DAG graph and automatically parallelizes your algorithms(nodes) over the cluster. you can keep your code simple (even single threaded) and let Hkube worry about the complications of distributed processing.
 
  **Language Agnostic** - Hkube is a container based framework and designed to facilitate the use of any language for your algorithm
 
**Batch algorithms**  -  With Hkube you can run algorithms as a batch, multiple instances of the same algorithm in order to accelerate the running of this specific algorithm   

 **Optimize Hardware utilization** - Hkube Automatically places containers based on their resource requirements and other constraints, while not sacrificing availability. Mix critical and best-effort workloads in order to drive up utilization and save even more resources. Hkube has metrics and AI engines that help learn about your algorithm (like run-time, cpu usage, priority ..) to make efficient execution and clustering.

**Build API** -   With Hkube you can just upload your code you don't have to worry about to build containers and how to integrate with Hkube API (of course you can do it if you like) The automatic builder feature will do it all for you.

**Debugging**-   Struggling on debugging your algorithm across the cluster Hkube makes this process really easy. this process can be done by running your algorithm on your pc on your IDE while the other algorithms run on the cluster. you can also run part of the pipeline with the results from the previous running which will make the debugging much faster

**Jupiter Integration** -  hkube has integration with jupiter so you able to scale  your running on top hkube via jupiter  


# Installation

## Prerequisite

Hkube runs on top of kubernetes so in order  to run hkube we have to install it's prerequisites

1. **Kubernetes** - Install  [Kubernetes](https://kubernetes.io/docs/user-journeys/users/application-developer/foundational/#section-1)  or  [Minikube](https://kubernetes.io/docs/tasks/tools/install-minikube/)  or  [microk8s](https://microk8s.io/)

	> Make sure kubectl is configured to your cluster.  
	> For collecting algorithm logs, and to create builds, Hkube requires that certain pods will run in privileged security permissions. Consult your kubernetes installation to see how to do that.
2.  **Helm** -  hkube installation uses helm for more information about how to install it follow this guide [helm installation](https://helm.sh/docs/using_helm/#installing-helm)

## Install 

1. **Add  Hkube helm repository** -  The chart is hosted in [http://hkube.io/helm/](http://hkube.io/helm/) To add the repo to your helm run 
``$ helm repo add hkube http://hkube.io/helm/``

2. **Install hkube chart** -  To install the chart with the release name `release name`
``$ helm install hkube/hkube --name my-release``

>This command installs `hkube` in a minimal configuration for development. For production installation follow the link here [production-deployment](http://hkube.io/learn/install/#production-deployment) 


# APIs

  There are three ways for communicating with hkube, REST, CLI and Hkube's UI dashboard.

### REST
 Hkube exposes it's functionality with REST, It is a good place to say that the CLI and the UI using the REST api for all of te operations so you probably can do anything  from the REST api without using any other tool. 
  
   - Spec -  From Hkube site  [http://hkube.io/spec/](http://hkube.io/spec/)
  - Swagger - locally  `{yourDomain}`/hkube/api-server/swagger-ui

### CLI
`hkubectl`  is a command-line tool that help you to work with hkube more easily.

**in order to use `hkubectl` you have to do the follows:**

- **Download** 
```bash
curl -Lo hkubectl https://github.com/kube-HPC/hkubectl/releases/download/v1.1.26/hkubectl && chmod +x hkubectl && sudo mv hkubectl /usr/local/bin/
```
**Config**

`hkubectl`  config set endpoint <KUBERNETES-MASTER-IP>/hkube/api-server/  
`hkubectl`  config set rejectUnauthorized false

**Syntax**
``hkubectl [type] [command] [name]``

use ``hkubectl --help`` for more information  

### UI 


Hkube as rich ui which supports pretty much every functionality hkube as to offer and even more .

![ui](https://user-images.githubusercontent.com/27515937/59031674-051b5180-886d-11e9-9806-ecce2e3ba8f0.png )

for more information and screenshots [http://hkube.io/tech/dashboard/](http://hkube.io/tech/dashboard/)


# First steps 

So now after we familiar with hkube's features and APIs 
lets create our first pipeline, hkube Supports two kinds of APIs for creating pipeline:  **JSON** and **Code**
 

##  Pipeline descriptor 

Lets use an example for demonstrating how the api works

![GraphGithub](https://user-images.githubusercontent.com/27515937/58963745-616f6a00-87b6-11e9-92d2-cf322bf343ed.png)


**The pipeline takes a number creates an array from 1 to  the number , multiply each of them with other number, and summarize them together**
 
 *for demonstration lets take `5` as  our first number and `2` as the second*
 - **Range algorithm:** creating an array with a length that matches the first input .     
     ``5-> [1,2,3,4,5]``
-  **Multiply algorithm:** multiples the received data from Add algorithm with the second input .     
    ``[1,2,3,4,5] (2) -> [2,4,6,8,10]``
-  **Reduce Algorithm**: the algorithm will wait until all the instances of the multiplication algorithm will finish then it will summarize the received data together.    
``[2,4,6,8,10] -> 30``


### JSON 
The pipeline descriptor is a JSON object which describes and defines the links between the nodes by defining the  dependency between them.
```JSON
{
	"name":"numbers",
	"nodes":[
		{ 
			"nodeName":"Range",
			"algorithmName":"range",
			"input":["@flowInput.data"]
		},
		{ 
			"nodeName":"Multiply",
			"algorithmName":"multiply",
			"input":["#@Add","@flowInput.mul"]
		},
		{ 
			"nodeName":"Reduce",
			"algorithmName":"reduce",
			"input":["@Multiply"]
		},
	],
	"flowInput":{
		"data":5,
		"mul":2
	}
}
```
**Hkube support three different types of special signs:**


**@** —  Defines input parameters for the algorithm .  
**#**  —  By using this in the input we can execute nodes in parallel .  
 **\*** -
 


 
A we can see we created a pipeline with the name numbers.  the pipeline is defined by three nodes, in Hkube, the linkage between the nodes is done by defining the algorithm inputs , for example, multiply will be run after add algorithm because of the input dependency between them. 

keep in mind that hkube will transport the results between the nodes automatically for doing it hkube currently support two different types of transportation layers *object storage* and *files system* 
the *flowInput* is the place to define the Pipeline inputs in the example above we we used  ``data:5``  but it could be anything .


theres a lot of great more features that can be define from the descriptor file

#### Other Options  (for advanced users )

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
**webhooks** - hkube has a REST api for getting the results but it support webhooks as well.  
There are two types of webhooks, *progress* and *result*. You can also fetch the same data from the REST API 
-  progress - ``{jobId}/api/v1/exec/status``
-  result -  ``{jobId}/api/v1/exec/results`` 

**priority**  -  Hkube support five level of priorities, five is the highest . those priorities with the metrics that hkube gathered helps to decide which algorithms should be run first .
**triggers** - there two types of triggers that hkube currently support *cron* and *pipeline*
  - **cron** - Hkube can schedule your stored pipelines based on cron pattern.  
see this [cron](https://crontab.guru/) editor in order to construct your cron.
 - **pipeline** - You can set your pipelines to run each time other pipeline/s has been  finished successfully.
 
 **options** - there is even other options can be configured 
  -  **Batch Tolerance** -  The Batch Tolerance is a threshold setting that allow to control in  	 which *percent* from the batch processing the entire pipeline should be fail.
  - **Concurrency** - Pipeline Concurrency define the number of pipelines that are allowed to be running at the same time
  - **TTL** - Time to live (TTL) limits the lifetime of pipeline in the cluster. stop will be sent if pipeline running for more than ttl (in seconds).
  - **Verbosity Level** -  The Verbosity Level is a setting that allow to control what type of progress events the client will notified about.  The severity levels are ascending from least important to most important: `trace`  `debug`  `info`  `warn`  `error`  `critical`
  
  
### Algorithm
 as you probably understood the pipeline is built from algorithms which containerized with docker. 
 There are two ways to integrate your algorithm into Hkube:  
  - **Seemless Integration** - As written above hkube can build automatically your docker with the Hkube's websocket wrapper.  
-  **Code writing** -  In order to add algorithm manually to hkube you need to wrap your algorithm with hkube . hkube already has a wrappers for python,javaScript, java and .NET core.

### Seemless Integration

Now lets create the algorithms from the numbers pipeline by our self, Hkube currently support two languages for auto build *Python* and *JavaScript* so we will those languages to create our algorithms. So we have three different algorithms *Range*, *Multiply* and *Reduce*

**Two important notes**

- **Installing dependencies**
 *During the container build, Hkube will search for the *requirements.txt* file and will try to install the packages from the pip package manager*

- **Advanced Operations**
 *Hkube can build the algorithm only by implementing start function but for advanced operation such as one time initiation and gracefully stopping you have to implement two other functions ``init`` and ``stop``

**So lets start by creating our algorithms**

 - **Range** - for the range algorithm we will use *Python* 
```Python
def start(args):
    print('algorithm: range start')
    input = args['input'][0]
    array = list(range(input))
    return array
```

*as you can see the start method calls with the args parameter, The inputs to the algorithm will appear in the ``input`` property, The ``input`` property is an array, so would like to take the first argument (``"input":["@flowInput.data"]`` as you can see we placed ``data`` as the first argument)*


 - **Multiply** - for this algorithm we will use *Python*  again
```Python
def start(args):
    print('algorithm: multiply start')
    input = args['input'][0]
    mul = args['input'][1]
    return input * mul
```

 *Lets remember in the inputs that we write in the descriptor ,  `"input":["#@Add","@flowInput.mul"]`* . 
 We sent two parameters, the first one is the ouput from *Add* that sent an array of numbers, but because we using *batch* sign (``#``) each multiply algorithm will get one item from the array, the second parameter we passing is  the *mul* parameter from the ``flowInput`` object.

- **Reduce** - we will use javascript for this algorithm
	
```javascript
module.exports.start = (args) => {
    console.log('algorithm: reduce start');
    const input = args.input[0];
    return input.reduce((acc, cur) => acc + cur);
}
```

*We placed``["@Multiply"]`` in the input parameter, HKube will collect all the data from the multiply algorithm and will sent it as an array in the first input parameter*

After we created the algorithms, all we have to do is to integrate them with hkube, for this tutorial we will use Hkube's CLI api but pretty much every operation can be done from Hkube's UI, 
 
for doing it we need to create a yaml (or json) that defines the algorithms (we will demonstrate the first but its pretty much the same operation to all of them)

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
To add it from the CLI we will use ``hkubectl algorithm apply --f range.yml`` (keep in mind we have to do it for all the algorithms)

```yaml
name: numbers
nodes:
- nodeName: Range
  algorithmName: range
  input:
  - "@flowInput.data"
- nodeName: Multiply
  algorithmName: multiply
  input:
  - "#@Range"
  - "@flowInput.mul" 
- nodeName: Reduce
  algorithmName: reduce
  input:
  - "@Multiply"
flowInput:
  data: 5
  mul: 2
```

There are two method to integrate pipeline with hkube 
 - **Raw** -  Ad-hoc pipeline running 
 - **Stored** - storing the pipeline descriptor for next running 

For running our pipeline as raw we will use ``hkubectl pipeline exec raw --f numbers.yml``

To store the pipeline we will have to create two different steps:
	1. ``hkubectl pipeline store --f numbers.yml`` for storing the pipeline  
	2. ``hkubectl pipeline exec stored numbers --f flowInput.yaml``
	
```yaml 
flowInput:
  data: 5
  mul: 2
```
As a result of executing pipeline, Hkube will return a **jobId**.  
This is a unique identifier which helps to query this specific pipeline execution.

you can stop the pipeline like this.
 `hkubectl exec stop <jobId> [reason]`

You can also track the pipeline status
 `hkubectl exec status <jobId>`

or the pipeline result
 `hkubectl exec result <jobId>`
