const RestServer = require('@hkube/rest-server');
const Experiment = require('../../../../lib/service/experiment');

const routes = () => {
    const router = RestServer.router();
    router.get('/', async (req, res) => {
        const { sort, order, limit } = req.query;
        const response = await Experiment.experimentsList({ sort, order, limit });
        res.json(response);
    });
    router.get('/:name?', async (req, res) => {
        const { name } = req.params;
        const response = await Experiment.getExperiment({ name });
        res.json(response);
    });
    router.post('/', async (req, res) => {
        const { name, description } = req.body;
        await Experiment.insertExperiment({ name, description });
        res.json({ message: 'OK', name });
    });
    router.delete('/:name?', async (req, res) => {
        const { name } = req.params;
        const response = await Experiment.deleteExperiment({ name });
        res.json(response);
    });
    return router;
};

module.exports = routes;
