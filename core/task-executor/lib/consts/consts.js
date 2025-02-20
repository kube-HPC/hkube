module.exports = {
    CPU_RATIO_PRESSURE: parseFloat(process.env.CPU_RATIO_PRESSURE) || 0.9,
    GPU_RATIO_PRESSURE: 1,
    MEMORY_RATIO_PRESSURE: parseFloat(process.env.MEMORY_RATIO_PRESSURE) || 0.8,
    MAX_JOBS_PER_TICK: process.env.MAX_JOBS_PER_TICK || 100,
    DEFAULT_SIDE_CAR_CPU: 0.1,
    DEFAULT_SIDE_CAR_MEMORY: '128Mi'
};
