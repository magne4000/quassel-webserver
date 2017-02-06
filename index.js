const {app, BrowserWindow} = require('electron');
var utils = require('./lib/utils');

var settings = new utils.settings(true);
settings.val.prefixpath = '../public'
const locals = {dev: true, settings};
var j = require('electron-pug')({pretty: true}, locals);

let mainWindow;
// process.argv.push("-m")
// process.argv.push("http")
// require('./app.js')

app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 400, height: 360, darkTheme: true});
  mainWindow.loadURL('file://'+__dirname+"/views/index.pug");
});
