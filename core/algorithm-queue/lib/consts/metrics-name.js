const METRICS = {
    QUEUE_COUNTER: 'algorithm_queue_queue_counter', // how much received
    QUEUE_AMOUNT: 'algorithm_queue_queue_amount', // current counter status
    TIME_IN_QUEUE: 'algorithm_queue_time_in_queue', // how long job stayed in queue
    TOTAL_SCORE: 'algorithm_queue_total_score',
    BATCH_SCORE: 'algorithm_queue_batch_score',
    PRIORITY_SCORE: 'algorithm_queue_priority_score',
    TIME_SCORE: 'algorithm_queue_time_score'
};

module.exports = METRICS;
