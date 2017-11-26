// const { expect } = require('chai');
// const Redis = require('ioredis');

// describe('Test', function () {
//     describe('Producer', function () {
//         describe('Validation', function () {
//             it('should throw validation error is not typeof', function (done) {
//                 const options = {
//                     job: {
//                         type: 'test-job',
//                         waitingTimeout: 'bla'
//                     }
//                 };
//                 const producer = new Producer(options);
//                 producer.createJob(options).catch((error) => {
//                     expect(error.message).to.equal('instance.job.waitingTimeout is not of a type(s) integer');
//                     done();
//                 });
//             });
//             it('should throw validation error is required', function (done) {
//                 const options = {};
//                 const producer = new Producer(options);
//                 producer.createJob(options).catch((error) => {
//                     expect(error.message).to.equal('instance.job.type is required');
//                     done();
//                 });
//             });
//         });
//         describe('CreateJob', function () {
//             it('should create job and return job id', function (done) {
//                 const producer = new Producer(globalOptions);
//                 producer.createJob(globalOptions).then((jobID) => {
//                     expect(jobID).to.be.a('string');
//                     done();
//                 });
//             });
//             it('should create job fire event job-failed', async function () {
//                 let job = null;
//                 const options = {
//                     job: {
//                         type: 'test-job-job-event-failed',
//                         data: { action: 'bla' }
//                     },
//                     setting: {
//                         createClient: globalOptions.setting.createClient
//                     }
//                 }
//                 const producer = new Producer(options);
//                 producer.on('job-failed', (jobID, err) => {
//                     if (job === jobID && err) {
//                         expect(jobID).to.be.a('string');
//                         expect(err).to.equal('test-job has been failed');
//                     }
//                 });
//                 const consumer = new Consumer(options);
//                 consumer.on('job', (job) => {
//                     job.done(new Error('test-job has been failed'))
//                 });
//                 consumer.register(options);
//                 job = await producer.createJob(options);
//             });
//             it('should create job fire event job-completed', async function () {
//                 let job = null;
//                 const res = { success: true };
//                 const options = {
//                     job: {
//                         type: 'test-job-job-event-completed',
//                         data: { action: 'bla' },
//                     },
//                     setting: {
//                         createClient: globalOptions.setting.createClient
//                     }
//                 }
//                 const producer = new Producer(options);
//                 producer.on('job-completed', (jobID, result) => {
//                     if (job === jobID) {
//                         expect(jobID).to.be.a('string');
//                         expect(result).to.deep.equal(res);
//                     }
//                 });
//                 const consumer = new Consumer(options);
//                 consumer.on('job', (job) => {
//                     job.done(null, res);
//                 });
//                 consumer.register(options);
//                 job = await producer.createJob(options);
//             });
//             it('should create job fire event job-active', async function () {
//                 let job = null;
//                 const options = {
//                     job: {
//                         type: 'test-job-job-event-active',
//                         data: { action: 'bla' }
//                     },
//                     setting: {
//                         createClient: globalOptions.setting.createClient
//                     }
//                 }
//                 const producer = new Producer(options);
//                 producer.on('job-active', (jobID) => {
//                     if (job === jobID) {
//                         expect(jobID).to.be.a('string');
//                     }
//                 });
//                 const consumer = new Consumer(options);
//                 consumer.register(options);
//                 job = await producer.createJob(options);
//             });
//             it('should create job and resolve on completed', async function () {
//                 let job = null;
//                 const res = { success: true };
//                 const options = {
//                     job: {
//                         type: 'test-job-job-completed',
//                         data: { action: 'bla' },
//                         resolveOnComplete: true
//                     },
//                     setting: {
//                         createClient: globalOptions.setting.createClient
//                     }
//                 }
//                 const producer = new Producer(options);
//                 producer.on('job-completed', (jobID, result) => {
//                     if (job === jobID) {
//                         expect(jobID).to.be.a('string');
//                         expect(result).to.deep.equal(res);
//                     }
//                 });
//                 const consumer = new Consumer(options);
//                 consumer.on('job', (job) => {
//                     job.done(null, res);
//                 });
//                 consumer.register(options);
//                 producer.createJob(options);
//             });
//             it('should create two differnt jobs', async function () {
//                 const options1 = {
//                     job: {
//                         type: 'test-job-ids',
//                         data: { action: 'test-1' },
//                         resolveOnComplete: true
//                     }
//                 }
//                 const options2 = {
//                     job: {
//                         type: 'test-job-ids',
//                         data: { action: 'test-2' },
//                         resolveOnComplete: true
//                     }
//                 }
//                 const res1 = { success: 'consumer-result-1' };
//                 const res2 = { success: 'consumer-result-2' };
//                 const consumer1 = new Consumer(options1);
//                 const consumer2 = new Consumer(options2);
//                 consumer1.register(options1);
//                 consumer2.register(options2);

//                 consumer1.on('job', (job) => {
//                     job.done(null, res1)
//                 });
//                 consumer2.on('job', (job) => {
//                     job.done(null, res2)
//                 });

//                 const producer1 = new Producer(options1);
//                 const producer2 = new Producer(options2);

//                 const results = await Promise.all([producer1.createJob(options1), producer2.createJob(options2)]);
//                 expect(results[0].result).to.deep.equal(res1);
//                 expect(results[1].result).to.deep.equal(res2);
//             });
//         });
//     });
//     describe('Consumer', function () {
//         describe('Validation', function () {
//             it('should throw validation error is not typeof', function () {
//                 const options = {
//                     setting: {
//                         queueName: []
//                     }
//                 };
//                 const func = () => new Consumer(options)
//                 expect(func).to.throw(Error, 'instance.queueName is not of a type(s) string');
//             });
//             it('should throw validation error prefix is not of a type', function () {
//                 const options = {
//                     job: {
//                         type: 'test-job',
//                     },
//                     setting: {
//                         prefix: []
//                     }
//                 };
//                 const func = () => new Consumer(options)
//                 expect(func).to.throw(Error, 'instance.prefix is not of a type(s) string');
//             });
//         });
//         describe('ConsumeJob', function () {
//             it('should consume a job with properties', async function () {
//                 const options = {
//                     job: {
//                         type: 'test-job-properties',
//                         data: { action: 'bla' }
//                     },
//                     setting: {
//                         queueName: 'sf-queue',
//                     }
//                 }
//                 const producer = new Producer(options);
//                 const consumer = new Consumer(options);
//                 consumer.on('job', (job) => {
//                     expect(job).to.have.property('id');
//                     expect(job).to.have.property('data');
//                     expect(job).to.have.property('type');
//                     expect(job).to.have.property('key');
//                     expect(job).to.have.property('done');
//                     done();
//                 });
//                 consumer.register(options);
//                 await producer.createJob(options);
//             });
//         });
//     });
//     describe('Stress', function () {
//         describe('CreateJob', function () {
//             it('should create job multiple times and set of results', function (done) {
//                 this.timeout(5000);
//                 const options = {
//                     job: {
//                         type: 'test-job-stress-produce',
//                         data: { action: 'test' }
//                     },
//                     setting: {
//                         queueName: 'queue-stress',
//                         prefix: 'jobs-stress',
//                         createClient: globalOptions.setting.createClient
//                     }
//                 }
//                 const producer = new Producer(options);
//                 const numOfJobs = 100;
//                 const range = Array.from({ length: numOfJobs }, (value, key) => (`queue-stress:jobs-stress:${key + 1}`));
//                 const promises = range.map(() => producer.createJob(options));
//                 Promise.all(promises).then((result) => {
//                     expect(result).to.have.lengthOf(numOfJobs);
//                     expect(result).to.deep.equal(range);
//                     done();
//                 })
//             });
//             it('should create and consume job multiple times', function (done) {
//                 this.timeout(5000);
//                 const options = {
//                     job: {
//                         type: 'test-job-stress-consume',
//                         data: { action: 'test' }
//                     },
//                     setting: {
//                         prefix: 'jobs-stress-2',
//                         createClient: (type) => {
//                             switch (type) {
//                                 case 'client':
//                                     return client;
//                                 case 'subscriber':
//                                     return subscriber;
//                                 default:
//                                     return createClient();
//                             }
//                         }
//                     }
//                 }
//                 const producer = new Producer(options);
//                 const consumer = new Consumer(options);
//                 consumer.on('job', (job) => {
//                     job.done(null, job.id);
//                 });
//                 consumer.register(options);
//                 const numOfJobs = 100;
//                 const range = Array.from({ length: numOfJobs }, (value, key) => (`queue-stress-2:jobs-stress-2:${key + 1}`));
//                 const promises = range.map(() => producer.createJob(options));
//                 Promise.all(promises).then((result) => {
//                     expect(result).to.have.lengthOf(numOfJobs);
//                     expect(result).to.deep.equal(range);
//                     done();
//                 })
//             });
//         });
//     });
// });
