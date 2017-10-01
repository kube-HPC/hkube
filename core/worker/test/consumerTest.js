const configIt = require('config.rf');
const Logger = require('logger.rf');
const VerbosityPlugin = require('logger.rf').VerbosityPlugin;

const Consumer = require('../lib/consumer/JobConsumer');
const { Producer } = require('producer-consumer.rf');

const expect = require('chai').expect

const jobConsumerConfig = {
    jobConsumer:{
        job: {
            type: 'test-job'
        },
        setting: {
            queueName: 'queue-workers',
            prefix: 'jobs-workers'
        }
    
    }
}

const testProducer = {
    job: {
        type: 'test-job',
        data: {
            inputs: {
                standard: 'input-1',
            }
        }
    }
}
const producerSettings={
    setting:{
        queueName: 'queue-workers',
        prefix: 'jobs-workers'
    }
}
let log;
let consumer;
let producer;
describe('consumer', () => {
    before(async () => {
        const {main, logger} = await configIt.load();
        log = new Logger(main.serviceName, logger);
        log.plugins.use(new VerbosityPlugin(main.redis));

        consumer = Consumer;
        await consumer.init(jobConsumerConfig);
    })

  
    it('should get job', (done) => {
        producer = new Producer(producerSettings);
        consumer.on('job',(job=>{
            done();
        }))
        producer.createJob(testProducer)
    })
})