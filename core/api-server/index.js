const { Producer } = require('raf-producer-consumer');
const api = require('./api/app-server')

const options = {
    job: {
        type: 'test-job',
        data: { action: 'bla' },
        waitingTimeout: 5000
    },
    queue: {
        priority: 1,
        delay: 1000,
        timeout: 5000,
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false
    },
    setting: {
        queueName: 'sf-queue',
        prefix: 'sf-jobs'
    }
}


const producer = new Producer(options);
const job = producer.createJob(options);

