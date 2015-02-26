/*
 * quassel-proxy
 * https://github.com/magne4000/quassel-proxy
 *
 * Copyright (c) 2014 Joël Charles
 * Licensed under the MIT license.
 */

var regex = /\./g;

function escapePathComponent(path) {
    return '/'+(path.replace(regex, '/'));
}

var patch = function(obj) {
    var ret = {
        op: null,
        path: null,
        value: null
    };
    switch (obj.type) {
        case 'add':
            ret.op = 'add';
            ret.value = obj.value;
            break;
        case 'update':
            ret.op = 'replace';
            ret.value = obj.value;
            break;
        case 'delete':
            ret.op = 'remove';
            break;
        default:
            console.log('Unhandled type ' + obj.type);
    }
    ret.path = escapePathComponent(obj.path);
    return [ret];
};

module.exports = patch;