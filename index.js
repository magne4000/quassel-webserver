const {app, BrowserWindow} = require('electron');
var utils = require('./lib/utils');

var settings = new utils.settings(true);
settings.val.prefixpath = '../dist'
const locals = {dev: true, settings};
var j = require('electron-pug')({pretty: true}, locals);

let mainWindow;


global.app_settings = {
	version: 1,
	settings: locals.settings.val.default,
	themes: locals.settings.val.themes
};


app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 400, height: 360, darkTheme: true});
  mainWindow.loadURL('file://'+__dirname+"/views/index.pug");
});
