const RestServer = require('@hkube/rest-server');
const tasksService = require('../../../../lib/service/tasks');
const formatter = require('../../../../lib/utils/formatters');

const createQueryObjectFromString = (str) => {
    return str?.replace(/\s/g, '').split(',').reduce((acc, cur) => {
        const [k, v] = cur.split(':');
        acc[k] = formatter.parseBool(v);
        return acc;
    }, {});
};

const routes = (options) => {
    const router = RestServer.router();
    router.get('/', (req, res) => {
        res.json({ message: `${options.version} ${options.file} api` });
    });
    router.get('/search', async (req, res) => {
        const { jobId, nodeName, cursor, page, sort, limit, fields, exists } = req.query;
        const search = {
            query: {
                jobId,
                nodeName
            },
            cursor,
            sort,
            pageNum: formatter.parseInt(page),
            limit: formatter.parseInt(limit),
            fields: createQueryObjectFromString(fields),
            exists: createQueryObjectFromString(exists)
        };
        const response = await tasksService.search(search);
        res.json(response);
    });
    return router;
};

module.exports = routes;
