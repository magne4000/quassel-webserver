var fs = require('fs');
var path = require('path');

function settings(warnuser, filename) {
    var val = null;
    if (filename != null) {
        if(!path.isAbsolute(filename)) {
            filename = __dirname + '/../' + filename;
        }
        if (!fs.existsSync(filename)) {
            console.log(' ! configfile does not exist');
            process.exit(5);
        }
        val = require(filename);
    } else if (fs.existsSync(__dirname + '/../settings-user.js')) {
        val = require(__dirname + '/../settings-user.js');
    } else {
        val = require(__dirname + '/../settings.js');
        if (warnuser === true) {
            console.log('WARNING: You should create a custom settings file -> cp settings.js settings-user.js');
        }
    }
    return val;
}

exports.settings = settings;