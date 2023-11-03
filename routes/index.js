import express from "express";

export const router = express.Router();
const SETTINGS_VERSION = 1;

/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', { title: 'Express' });
});

/* GET settings. */
router.get('/settings', function (req, res) {
    res.json({
        version: SETTINGS_VERSION,
        settings: req.app.locals.settings.val.default,
        themes: req.app.locals.settings.val.themes
    });
});
