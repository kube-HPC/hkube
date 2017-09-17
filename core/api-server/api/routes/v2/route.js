var express = require('express')
var router = express.Router();

router.get('/about', function (req, res) {
    res.send('About routs v2')
})

module.exports = router;