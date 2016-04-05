var express = require('express');
var router = express.Router();
var settings = require('../lib/utils').settings();

var SETTINGS_VERSION = 1;

if (!settings.default.theme) {
    settings.default.theme = 'default';
}

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express', settings: settings});
});

/* GET settings. */
router.get('/settings', function(req, res) {
  res.json({version: SETTINGS_VERSION, settings: settings.default, themes: settings.themes});
});

module.exports = router;
