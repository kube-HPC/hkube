const innerValidator = require('./inner-validator');
const {
    Algorithms,
    Boards,
    Builds,
    Cron,
    Executions,
    Experiments,
    Graphs,
    Internal,
    Jobs,
    Lists,
    Pipelines,
    DataSources,
} = require('./index');

class ApiValidator {
    init(schemas, schemasInternal) {
        innerValidator.init(schemas, schemasInternal);
        this.algorithms = new Algorithms(innerValidator);
        this.boards = new Boards(innerValidator);
        this.builds = new Builds(innerValidator);
        this.cron = new Cron(innerValidator);
        this.executions = new Executions(innerValidator);
        this.experiments = new Experiments(innerValidator);
        this.graphs = new Graphs(innerValidator);
        this.internal = new Internal(innerValidator);
        this.jobs = new Jobs(innerValidator);
        this.pipelines = new Pipelines(innerValidator);
        this.lists = new Lists(innerValidator);
        this.dataSources = new DataSources(innerValidator);
    }
}

module.exports = new ApiValidator();
