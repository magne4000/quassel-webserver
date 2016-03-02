var express = require('express');
var router = express.Router();
var settings = require('../lib/utils').settings();

if (!settings.default.theme) {
    settings.default.theme = 'default';
}

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express', settings: settings});
});

/* GET settings. */
router.get('/settings', function(req, res) {
  res.json({settings: settings.default, themes: settings.themes});
});

module.exports = router;
