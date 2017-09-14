const validate = require('./app');

const json = {
    "name": "unknown",
    "type": "object",
    "properties": {
        "id": {
            "type": "string",
         //   "default": "id",
            "required": true
        },
        "info": {

            "type": "object",
            "properties": {
                "age": {
                    "type": "integer",
        //            "default": 30,
                    "required": true
                },
                "familyName": {
                    "type": "string",
                    "default": "unknown",
                    "required": false,

                },
            }
        }
    }
}

let validateWithSchema = validate(json);
let obj = { id: "12345", info: { age: 6 } };
//console.log(JSON.stringify(validateWithSchema(obj,{ignoreNull:false}).instance));
//console.log(JSON.stringify(validate(json, { id: "12345", info: { age: 6 } }).instance))
console.log(JSON.stringify(validate(json, { id: "12345" }).instance))


validateWithSchema = validate(json);
console.log(JSON.stringify(validateWithSchema({ id: "12345", info: { age: 6, familyName: null } }).instance))
console.log(JSON.stringify(validateWithSchema({ id: "12345", info: { age: 6, familyName: null } }, { ignoreNull:true }).instance))

