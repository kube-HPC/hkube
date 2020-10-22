const { Router } = require('express');
const { lchown } = require('fs-extra');
const multer = require('multer');
const upload = multer({ dest: 'uploads/datasource/' });
// consider replacing multer with busboy to handle the stream without saving to disk
const dataSource = require('../../../../lib/service/dataSource');
const validation = require('../../../../lib/validation');

const routes = () => {
    const router = Router();
    router
        .route('/')
        .get(async (req, res) => {
            const dataSources = await dataSource.list();
            res.json(dataSources);
        })
        .post(upload.single('file'), async (req, res) => {
            const { name } = req.body;
            const response = await dataSource.createDataSource(name, req.file);
            // // create the data source on the db
            // // upload file to storage
            // console.log({ name, fileName });
            return res.status(201).json(response);
        });

    router
        .route('/:id')
        .get(async (req, res) => {
            const { id } = req.params;
            const response = await dataSource.fetchDataSource(id);
            return res.json({ dataSource: response });
        })
        .put(upload.single('file'), async (req, res) => {
            const { id } = req.params;
            const fileName = await dataSource.uploadFile(id, req.file);
            console.log({ fileName });
            return res.sendStatus(201);
        });

    router.get('/:id/:fileName', (req, res) => {
        const { id, fileName } = req.params;
        const stream = dataSource.fetchFile(id, fileName);
        // fetch file from the storage
        return res.sendStatus(501);
    });
    return router;
};

module.exports = routes;
