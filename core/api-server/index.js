const { producer } = require('raf-tasq');
const options = {
    job: {
        type: 'test-job',
        data: { action: 'bla' },
    }
}
const job = await producer.createJob(options);