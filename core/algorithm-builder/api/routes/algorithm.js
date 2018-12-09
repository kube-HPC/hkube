const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'uploads/zipped/' });
const builder = require('../../lib/builder');

const routes = (options) => {
    const router = express.Router();
    router.get('/', (req, res, next) => {
        res.json({ message: `${options.serviceName} api` });
        next();
    });
    router.post('/algorithms/create', upload.single('code'), async (req, res, next) => {
        builder.build({ payload: req.body.payload, file: req.file.path }).then((response) => {
            res.json(response);
            next();
        }).catch((error) => {
            return next(error);
        });
    });
    return router;
};

module.exports = routes;
