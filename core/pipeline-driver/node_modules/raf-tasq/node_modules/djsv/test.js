const validate = require('./app');

const json = {
    "name": "unknown",
    "type": "object",
    "properties": {
        "id": {
            "type": "string",
            "default": "id",
            "required": true
        },
        "info": {

            "type": "object",
            "properties": {
                "age": {
                    "type": "integer",
                    "default": 30,
                    "required": true
                },
            }
        }
    }
}

let validateWithSchema = validate(json);
let obj= { id: "12345", info: { age: 6 } };
console.log(JSON.stringify(validateWithSchema(obj).instance));
console.log(JSON.stringify(validate(json, { id: "12345", info: { age: 6 } }).instance))
console.log(JSON.stringify(validate(json, { id: "12345" }).instance))

