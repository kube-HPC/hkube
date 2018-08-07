const workersStub = [
  {
    id: '544d9748-f42c-4cfd-a9c1-57a34ab6f473',
    algorithmName: 'black-alg',
    workerStatus: 'ready',
    podName: 'black-alg-5d58952d-6358-4981-985a-d49baab93f85-gv5dr'
  },
  {
    id: '5a4600f0-2981-4211-aef4-ffc15ae81c8a',
    algorithmName: 'black-alg',
    workerStatus: 'ready',
    podName: 'black-alg-a3acf766-6399-465f-ba32-3a3970ccac09-dhrhg'
  },
  {
    id: 'a5959ebf-572c-46ba-93ce-86a5a7cbb10f',
    algorithmName: 'black-alg',
    workerStatus: 'ready',
    podName: 'black-alg-c800f77d-8e1e-40c9-accf-d2366f53638a-vtfzc'
  },
  {
    id: 'a5b14ee1-fc11-49dc-85e9-9a1e8d9fa32d',
    algorithmName: 'green-alg',
    workerStatus: 'ready',
    podName: 'green-alg-e6f3b455-27eb-406c-ab94-b7903c9b91a2-8sjml'
  }
]

const jobsStub = [
  {
    name: 'black-alg-5d58952d-6358-4981-985a-d49baab93f85',
    algorithmName: 'black-alg',
    active: true
  },
  {
    name: 'black-alg-a3acf766-6399-465f-ba32-3a3970ccac09',
    algorithmName: 'black-alg',
    active: true
  },
  {
    name: 'black-alg-c800f77d-8e1e-40c9-accf-d2366f53638a',
    algorithmName: 'black-alg',
    active: true
  },
  {
    name: 'green-alg-e6f3b455-27eb-406c-ab94-b7903c9b91a2',
    algorithmName: 'green-alg',
    active: true
  }
]

module.exports = {
  jobsStub,
  workersStub
}  