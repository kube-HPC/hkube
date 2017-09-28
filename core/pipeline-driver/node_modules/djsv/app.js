const { validate } = require('jsonschema');
const jsonDefaults = require('json-schema-defaults');
const defaultsDeep = require('lodash.defaultsdeep');
const omitby = require('lodash.omitby');
const isNil = require('lodash.isnil');
const curry = require('lodash.curry');



const isObject = val =>
    typeof val === 'object' && !Array.isArray(val);


const recursivelyOmitByUnit = (object) => {
    return Object.values(object).map(obj => {
        if (isObject(obj)) {
            obj = omitby(obj, isNil)
            recursivelyOmitByUnit(obj);
        }
        return obj
    })
}
const deepOmitby = object => {
    let returnedObj = {};
    let i = 0;
    let obj = recursivelyOmitByUnit(object)
    obj.forEach(item => {
        returnedObj[Object.keys(object)[i]] = item;
        i++
    });
    object = returnedObj;
    return object;
}

/**
/**
 * valid first check valid options and then add defailt property 
 * 
 * @param {any} jsonschema valid json schema 
 * @param {any} options options Object
 * @param {bool}options.ignoreNull default=false, allows to replace null property object with the default   
 * @param {any} validateObj the object you wish to check  
 * @returns if valid returns the schema with it's defaults  if not return jsonschema error 
 */

const _validator = (jsonschema, validateObj, options = { ignoreNull: false }) => {
    if (options.ignoreNull) {
        validateObj=validateObj?validateObj:{};
        validateObj = deepOmitby(validateObj)
    }
    defaultsDeep(validateObj, jsonDefaults(jsonschema));
    // defaultsDeep(validateObj, jsonDefaults(jsonschema));
    let val = validate(validateObj, jsonschema);
    return val
}




module.exports = curry(_validator);