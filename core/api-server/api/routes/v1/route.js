var express = require('express')
var router = express.Router();

router.get('/about', function (req, res) {
    res.send('About v1')
})

module.exports = router;