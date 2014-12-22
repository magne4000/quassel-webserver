var express = require('express');
var router = express.Router();
var settings = require('../settings');

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express', settings: settings});
});

router.get('/interface', function(req, res) {
  res.render('interface', { title: 'Express' });
});

module.exports = router;
