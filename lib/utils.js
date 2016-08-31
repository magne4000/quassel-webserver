var fs = require('fs');

function settings(warnuser, path) {
    var val = null, realpath = null;
    if (path) {
        if (fs.existsSync(path)) {
            realpath = fs.realpathSync(path);
            val = require(realpath);
            console.log('SETTINGS: Using ' + realpath);
        }
    } else if (fs.existsSync(__dirname + '/../settings-user.js')) {
        realpath = fs.realpathSync(__dirname + '/../settings-user.js');
        val = require(realpath);
        console.log('SETTINGS: Using ' + realpath);
    }
    if (val === null) {
        realpath = fs.realpathSync(__dirname + '/../settings.js');
        val = require(realpath);
        if (warnuser === true) {
            console.log('WARNING: You should create a custom settings file -> cp settings.js settings-user.js');
            console.log('SETTINGS: Using ' + realpath);
        }
    }
    return val;
}

exports.settings = settings;