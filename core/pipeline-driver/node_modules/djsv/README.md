## jsonschema-validate-default
just a tiny libary based on jsonschema libary that allows you to test if your object is valid and if so to combine it with your deafults data



### usage example

### lazy 
```js
const validate = require('jsonschema-default-validator');

// create your schema
const json = {
    "name": "unknown",
    "type": "object",
    "properties": {
        "id": {
            "type": "string",
            "default": "id",
            "required": true
        },
        "age": {
            "default": 30,
            "type": "integer"
        }
    }
}

 let validObject = validate(json,{id:"maty"}) //=> {id:"maty",age:30}
 let validObject = validate(json,{id:"maty",age:20}) //=> {id:"maty",age:20}
 let validObject = validate(json,{age:20}) //=> {id:"maty",age:20} => error:{valid:false, errorDescription:"id is required"}
 let validObject = validate(json,{id:123456}) //=> error:{valid:false, errorDescription:"id is not a string error "}
```

### with schema initiation before
```js

let validateWithSchema = validate(json);
let obj= { id: "12345", info: { age: 6 } };
console.log(JSON.stringify(validateWithSchema(obj).instance));
```

### ignore null option
ignorenull option allows you to set the default param in the return object although the value is defiend 

```js 

validateWithSchema = validate(json);
console.log(JSON.stringify(validateWithSchema({ id: "12345", info: { age: 6, familyName: null } }).instance)) //=> {"id":"12345","info":{"age":6,"familyName":null}}
console.log(JSON.stringify(validateWithSchema({ id: "12345", info: { age: 6, familyName: null } }, { ignoreNull:true }).instance)) //=>{"id":"12345","info":{"age":6,"familyName":"unknown"}}

``` 