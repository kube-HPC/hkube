const Queue = require('./queue');
const HeuristicRunner = require('./heuristic-runner');
const Persistence = require('./persistency/persistence');

class QueueRunner {
    create({ algorithmName, options }) {
        const scoreHeuristic = new HeuristicRunner(options.heuristicsWeights);
        const queue = new Queue({
            algorithmName,
            updateInterval: options.queue.updateInterval,
            algorithmMinIdleTimeMS: options.algorithmQueueBalancer.algorithmMinIdleTimeMS,
            scoreHeuristic: (...args) => scoreHeuristic.run(...args),
            persistence: new Persistence({ algorithmName }),
        });
        return queue;
    }
}

module.exports = new QueueRunner();
