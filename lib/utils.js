var fs = require('fs');

function settings(warnuser) {
    var val = null;
    if (fs.existsSync(__dirname + '/../settings-user.js')) {
        val = require(__dirname + '/../settings-user.js');
        if (val.hasOwnProperty('unsecurecore') || val.hasOwnProperty('theme') || !val.default.hasOwnProperty('unsecurecore') || !val.default.hasOwnProperty('theme') || !val.hasOwnProperty('themes')) {  // v2
            console.log('WARNING: You should update your settings-user.js file. See settings.js');
        }
    } else {
        val = require(__dirname + '/../settings.js');
        if (warnuser === true) {
            console.log('WARNING: You should create a custom settings file -> cp settings.js settings-user.js');
        }
    }
    return val;
}

exports.settings = settings;