var express = require('express')
var router = express.Router();

router.get('/run', function (req, res) {
    res.send('About run v1')
})

module.exports = router;