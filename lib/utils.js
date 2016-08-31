var fs = require('fs');

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) { /**/ }

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

function extend() {
	var options, name, src, copy, copyIsArray, clone;
	var target = arguments[0];
	var i = 1;
	var length = arguments.length;
	var deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
}

function settings(warnuser, path) {
    var val = null, realpath = null, defaultsettings = {};
    var defrealpath = fs.realpathSync(__dirname + '/../settings.js');
    if (fs.existsSync(defrealpath)) {
        defaultsettings = require(defrealpath);
    }
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
        val = defaultsettings;
        if (warnuser === true) {
            console.log('WARNING: You should create a custom settings file -> cp settings.js settings-user.js');
            console.log('SETTINGS: Using ' + defrealpath);
        }
    } else {
        val = extend(true, {}, defaultsettings, val);
    }
    return val;
}

exports.settings = settings;
exports.extend = extend;