const RestServer = require('@hkube/rest-server');
const auth = require('../../../../lib/service/auth');

const routes = () => {
    const router = RestServer.router();
    router.post('/login', async (req, res, next) => {
        try {
            // const { username, password } = req.body;
            const data = await auth.login(req.body);
            res.json({ data });
        }
        catch (e) {
            next(e);
        }
    });
    return router;
};
module.exports = routes;
