var express = require('express');
var router = express.Router();
var settings = require('../settings');

if (!settings.theme) {
    settings.theme = 'default';
}

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express', settings: settings});
});

module.exports = router;
