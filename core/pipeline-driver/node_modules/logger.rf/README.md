# Logger
##### the best js logger ever :)

### The following options available
- running logs with elastic fluentd  conosle and view in kibana 
- costomize your log level and colors by sending it from the logger constructor the following availble by default ```debug,info,warning,error,critical``` 
    ```
         var config = {
            levels: {
                silly: 0,
                debug: 1,
                info: 2,
                warning: 3,
                error: 4,
                critical: 5
            },
            colors: {
                silly: 'white',
                debug: 'grey',
                info: 'white',
                warning: 'yellow',
                error: 'red',
                critical: 'red'
            }
        };
    ```
- creating multiple log that differnts from each other
- lazy loading your log from each module ```Logger.GetLogFromContanier(ServiceName)```
- controling log trace level and update it during run using ```updateTraceLevel(levelNumber) ```
- an abiltiy to set component name and other metaData ``` log.info('hi info test',{component: 'test-Component'}); ```
- costomize your log colors with colors api for example ``` log.info('hi info test'.green); or log.info(('hi info test')[green]);  ```
- builtin metadata addition such as printing call stack trace for error and critical
- additions with extra details for logs during run by setting  ```extraDetails``` flag to ```true``` will print this as extrad details  ```{{ function: null file: /home/matyz/dev/vod/core/logger/test/test.js lineNumber: 160 }}```
- built in template that includes time log level and component name ```September 1st 2016, 12:26:52 pm  ->  info: ( test-Component ) hi info test``` 


### running 
    in order to run you can clone the repo or using ```npm install logger ```


configuration 
```js
  machineType:"test",
    transport : {
        console: true,
        fluentd: false,
        logstash: false,
        file: false
    },
    logstash : {
        logstashURL: "127.0.0.1",
        logstashPort: 28777
    },
    extraDetails :false,
    verbosityLevel : 1,
    isDefault:true

```


### usage example:
#### init 
```js
var Logger = require('logger');
let log = new Logger('test',relativeConfig);
```

### get  created logger
- use this if know the log container name
```js
var log = Logger.GetLogFromContainer(RMS.ServiceName);
```
-  don't need to send container name if  set this logger as default with ```isDefault:true```
```js
var log = Logger.GetLogFromContainer();
```
### log printing 
```js
  log.info('running application in ' + conf.env() + ' environment', {component: componentName.MAIN});    
  log.error('Error response, status=' + res.status + ', message=' + res.error.message, {component: componentName.REST_API});
```


## ENJOY :)