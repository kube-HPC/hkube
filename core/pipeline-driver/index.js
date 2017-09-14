const producer = require('./lib/producer/jobs-producer');
const consumer = require('./lib/consumer/jobs-consumer');
const stateManager = require('./lib/state/state-manager');

stateManager.init();
producer.init();
consumer.init();


// TEST
const { Producer } = require('raf-tasq');
const validate = require('djsv');
const schema = require('./lib/consumer/schema.js');

const setting = {};
const res = validate(schema, setting);
const p = new Producer(setting);
p.createJob(setting);
//p.createJob(setting);
//p.createJob(setting);