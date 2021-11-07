const innerValidator = require('./inner-validator');
const {
    Algorithms,
    Boards,
    Builds,
    Cron,
    Executions,
    Experiments,
    Gateways,
    Graphs,
    Internal,
    Jobs,
    Lists,
    Pipelines,
    DataSources,
    Outputs,
    Devenvs
} = require('./index');

class ApiValidator {
    init(schemas) {
        innerValidator.init(schemas);
        this.algorithms = new Algorithms(innerValidator);
        this.boards = new Boards(innerValidator);
        this.devenvs = new Devenvs(innerValidator);
        this.builds = new Builds(innerValidator);
        this.cron = new Cron(innerValidator);
        this.executions = new Executions(innerValidator);
        this.experiments = new Experiments(innerValidator);
        this.gateways = new Gateways(innerValidator);
        this.outputs = new Outputs(innerValidator);
        this.graphs = new Graphs(innerValidator);
        this.internal = new Internal(innerValidator);
        this.jobs = new Jobs(innerValidator);
        this.pipelines = new Pipelines(innerValidator);
        this.lists = new Lists(innerValidator);
        this.dataSources = new DataSources(innerValidator);
    }
}

module.exports = new ApiValidator();
