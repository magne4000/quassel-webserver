/*
 * quassel-proxy
 * https://github.com/magne4000/quassel-proxy
 *
 * Copyright (c) 2014 Joël Charles
 * Licensed under the MIT license.
 */

var patch = function(obj) {
    var ret = {
        op: null,
        path: null,
        value: null
    };
    switch (obj.type) {
        case 'add':
            ret.op = 'add';
            break;
        case 'update':
            ret.op = 'replace';
            break;
        case 'delete':
            ret.op = 'remove';
            break;
        default:
            console.log('Unhandled type ' + obj.type);
    }
    ret.path = '/'+(obj.path.replace(/\./g, '/'));
    ret.value = obj.value;
    return [ret];
};

module.exports = patch;