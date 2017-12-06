const Execution = require('lib/service/ExecutionService');
const express = require('express');

const routes = function (options) {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.version} ${options.file} api` });
        next();
    });
    router.post('/raw', (req, res, next) => {
        // if (req.method === 'GET') {
        //     res.set('Allow', 'POST');
        //     res.status(405).json('Method Not Allowed');
        //     return;
        // }
        Execution.runRaw(req.body).then((response) => {
            res.json({ execution_id: response });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.post('/stored', (req, res, next) => {
        Execution.runStored(req.body).then((response) => {
            res.json({ execution_id: response });
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    router.route('/status/:execution_id?')
        .get((req, res, next) => {
            const execution_id = req.params.execution_id || req.query.execution_id;
            Execution.getJobStatus({ execution_id }).then((response) => {
                res.json(response);
                next();
            }).catch((error) => {
                return next(error);
            });
        })
        .put((req, res, next) => {
            next(new Error('not implemented'));
        })
        .post((req, res, next) => {
            next(new Error('not implemented'));
        })
        .delete((req, res, next) => {
            next(new Error('not implemented'));
        });

    router.route('/results/:execution_id?')
        .get((req, res, next) => {
            const execution_id = req.params.execution_id || req.query.execution_id;
            Execution.getJobResult({ execution_id }).then((response) => {
                res.json(response);
                next();
            }).catch((error) => {
                return next(error);
            });
        })
        .put((req, res, next) => {
            next(new Error('not implemented'));
        })
        .post((req, res, next) => {
            next(new Error('not implemented'));
        })
        .delete((req, res, next) => {
            next(new Error('not implemented'));
        });

    router.post('/stop', (req, res, next) => {
        Execution.stopJob(req.body).then((response) => {
            res.json({ message: 'OK' });
            next();
        }).catch((error) => {
            return next(error);
        });
    });

    return router;
};

module.exports = routes;

