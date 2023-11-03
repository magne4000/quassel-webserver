import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hasOwn = Object.prototype.hasOwnProperty;
const toStr = Object.prototype.toString;

const isArray = function isArray(arr) {
    if (typeof Array.isArray === 'function') {
        return Array.isArray(arr);
    }

    return toStr.call(arr) === '[object Array]';
};

const isPlainObject = function isPlainObject(obj) {
    if (!obj || toStr.call(obj) !== '[object Object]') {
        return false;
    }

    const hasOwnConstructor = hasOwn.call(obj, 'constructor');
    const hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
    // Not own constructor property must be Object
    if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
        return false;
    }

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    let key;
    for (key in obj) { /**/
    }

    return typeof key === 'undefined' || hasOwn.call(obj, key);
};

export function extend() {
    let options, name, src, copy, copyIsArray, clone;
    let target = arguments[0];
    let i = 1;
    let deep = false;

    // Handle a deep copy situation
    if (typeof target === 'boolean') {
        deep = target;
        target = arguments[1] || {};
        // skip the boolean and the target
        i = 2;
    } else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
        target = {};
    }

    for (; i < arguments.length; ++i) {
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

export class Settings {
    val = null;

    async init(warnuser, path) {
        let realPath = null, defaultSettings = {};
        const defaultSettingsRealPath = fs.realpathSync(__dirname + '/../settings.cjs');

        if (fs.existsSync(defaultSettingsRealPath)) {
            defaultSettings = (await import(defaultSettingsRealPath))?.default;
        }
        if (path) {
            if (fs.existsSync(path)) {
                realPath = fs.realpathSync(path);
                this.val = (await import(realPath)).default;
                console.log('SETTINGS: Using ' + realPath);
            }
        } else {
            if (fs.existsSync(__dirname + '/../settings-user.js')) {
                fs.renameSync(__dirname + '/../settings-user.js', __dirname + '/../settings-user.cjs');
            }
            if (fs.existsSync(__dirname + '/../settings-user.cjs')) {
                realPath = fs.realpathSync(__dirname + '/../settings-user.cjs');
                this.val = (await import(realPath)).default;
                console.log('SETTINGS: Using ' + realPath);
            }
        }
        if (this.val === null) {
            this.val = defaultSettings;
            if (warnuser === true) {
                console.log('WARNING: You should create a custom settings file -> cp settings.cjs settings-user.cjs');
                console.log('SETTINGS: Using ' + defaultSettingsRealPath);
            }
        } else {
            this.val = extend(true, {}, defaultSettings, this.val);
        }

        if (!this.val.default.theme) {
            this.val.default.theme = 'default';
        }
    }
}

Settings.prototype.prefix = function (s) {
    return this.val.prefixpath + s;
};
