
## Documentation

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
- #@ - run as batch
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
        {"data": "result": "links-1-result"},
        {"data": "result": "links-2-result"},
        {"data": "result": "links-3-result"}
]
```
when green node completes his job, yellow node will start.  
You can see that yellow node needs the green node results, the inner results, and flowInput.files1  
So the input of yellow node will look like this:  
```js
[
    [
        {"data": "result": "links-1-result"},
        {"data": "result": "links-2-result"},
        {"data": "result": "links-3-result"}
    ],
    [
        "links-1-result",
        "links-2-result",
        "links-3-result"
    ],
    [
        {"custom": 'links-1'}, 
        {"custom": 'links-2'}, 
        {"custom":'links-3'}
    ]
]

```

