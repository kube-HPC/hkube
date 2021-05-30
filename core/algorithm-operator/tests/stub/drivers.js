const { uid } = require('@hkube/uid');

module.exports = [
    {
        driverId: uid(),
        paused: false,
        idle: true,
        jobs: [],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: true,
        jobs: [],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: true,
        jobs: [],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: true,
        jobs: [],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: true,
        jobs: [],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: true,
        jobs: [],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: false,
        jobs: [{ jobId: 'abc', status: 'active' }],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: false,
        jobs: [{ jobId: 'abc', status: 'active' }],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: false,
        jobs: [{ jobId: 'abc', status: 'active' }],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: true,
        idle: true,
        jobs: [],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: true,
        idle: false,
        jobs: [{ jobId: 'abc', status: 'active' }],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: false,
        jobs: [{ jobId: 'abc', status: 'active' }],
        podName: uid()
    },
    {
        driverId: uid(),
        paused: false,
        idle: true,
        jobs: [],
        podName: uid()
    }
];