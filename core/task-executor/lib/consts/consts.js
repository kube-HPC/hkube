module.exports = {
    CPU_RATIO_PRESSURE: parseFloat(process.env.CPU_RATIO_PRESSURE) || 0.9,
    GPU_RATIO_PRESSURE: 1,
    MEMORY_RATIO_PRESSURE: parseFloat(process.env.MEMORY_RATIO_PRESSURE) || 0.8,
    MAX_JOBS_PER_TICK: process.env.MAX_JOBS_PER_TICK || 100,
    SIDECAR_DEFAULT_RESOURCES: { 
        requests: {
            cpu: process.env.SIDECAR_DEFAULT_REQUEST_CPU || '100m',
            memory: process.env.SIDECAR_DEFAULT_REQUEST_MEMORY || '64Mi'
        },
        limits: {
            cpu: process.env.SIDECAR_DEFAULT_LIMIT_CPU || '150m',
            memory: process.env.SIDECAR_DEFAULT_LIMIT_MEMORY || '96Mi'
        }
    }
};
