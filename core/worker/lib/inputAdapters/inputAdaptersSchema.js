const adapters = require('./consts').adapters;
const inputAdaptersSchema = {
    type:'object',
    properties:{
        storagePath:{
            type:'string',
            required:true
        }
    }
}
module.exports={
    inputAdaptersSchema
}