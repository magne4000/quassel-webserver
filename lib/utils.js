var fs = require('fs');

function settings(warnuser) {
    var val = null;
    if (fs.existsSync(__dirname + '/../settings-user.js')) {
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