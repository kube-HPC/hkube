const METRICS = {
    QUEUE_COUNTER: 'pipeline_driver_queue_counter', // how much received
    QUEUE_AMOUNT: 'pipeline_driver_queue_amount', // current counter status
    TIME_IN_QUEUE: 'pipeline_driver_queue_time_in_queue', // how long job stayed in queue
    TOTAL_SCORE: 'pipeline_driver_queue_total_score',
    BATCH_SCORE: 'pipeline_driver_queue_batch_score',
    PRIORITY_SCORE: 'pipeline_driver_queue_priority_score',
    TIME_SCORE: 'pipeline_driver_queue_time_score',
};

module.exports = METRICS;
