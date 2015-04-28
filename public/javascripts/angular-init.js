angular.module('quassel', ['ngSocket', 'ngSanitize', 'er', 'ui.bootstrap', 'dragAndDrop', 'cgNotify'])
.config(["$socketProvider", function ($socketProvider) {
    $socketProvider.setOptions({
        timeout: 6000,
        reconnectionAttempts: 5,
        path: location.pathname + 'socket.io'
    });
}])
.factory('$networks', function(){
    var networks = null;
    return {
        get: function() {
            return networks;
        },
        set: function(obj) {
            networks = obj;
        }
    };
})
.factory('$reviver', [function(){
    var NetworkCollection = require('network').NetworkCollection;
    var Network = require('network').Network;
    var IRCMessage = require('message').IRCMessage;
    var IRCBufferCollection = require('buffer').IRCBufferCollection;
    var IRCBuffer = require('buffer').IRCBuffer;
    var IRCUser = require('user');
    var HashMap = require('serialized-hashmap');
    var Reviver = require('serializer').Reviver;
    var IgnoreList = require('ignore').IgnoreList;
    var IgnoreItem = require('ignore').IgnoreItem;
    var reviver = new Reviver(NetworkCollection, Network, IRCBufferCollection, IRCBuffer, IRCUser, HashMap, IRCMessage, IgnoreList, IgnoreItem);
    
    return reviver;
}])
.factory('$favico', [function() {
    var num = 0;
    var favico = new Favico({
        animation: 'pop',
        type: 'rectangle',
        bgColor: '#f0ad4e',
        textColor: '#fff'
    });

    var more = function() {
        num = num + 1;
        favico.badge(num);
    };
    
    var less = function() {
        num = (num-1 < 0) ? 0 : (num - 1);
        favico.badge(num);
    };
    
    var reset = function() {
        favico.reset();
    };

    return {
        more: more,
        less: less,
        reset: reset
    };
}])
.factory('$alert', ['notify', function(notify) {
    
    notify.config({startTop: 2, verticalSpacing: 4, duration: 8000});
    
    function info(message, options) {
        options = options || {};
        options.message = message;
        options.classes = ["alert-info"];
        notify(options);
    }
    
    function warn(message, options) {
        options = options || {};
        options.message = message;
        options.classes = ["alert-warning"];
        notify(options);
    }
    
    function error(message, options) {
        options = options || {};
        options.message = message;
        options.classes = ["alert-danger"];
        notify(options);
    }
    
    return {
        info: info,
        warn: warn,
        error: error
    };
}])
.factory('$desktop', [function(){
    var granted = false;
    if (!("Notification" in window)) {
        granted = false;
    } else if (Notification.permission === "granted") {
        granted = true;
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission(function (permission) {
            if(!('permission' in Notification)) {
                Notification.permission = permission;
            }
            granted = permission === "granted";
        });
    }
    
    return function(title, body){
        if (granted) {
            var options = {};
            if (body) options.body = body;
            return new Notification(title, options);
        }
    };
}])
.factory('$theme', [function(){
    var defaultTheme = '';
    var packagedThemes = [
        'default',
        'darksolarized',
    ];

    return {
        setDefaultTheme: function(theme) {
            defaultTheme = theme;
        },
        getClientTheme: function() {
            return localStorage.defaultTheme || null;
        },
        setClientTheme: function(theme) {
            localStorage.defaultTheme = theme;
        },
        getAllThemes: function() {
            var themes = [].concat(packagedThemes);
            if (defaultTheme && themes.indexOf(defaultTheme) === -1) {
                themes.push(defaultTheme);
            }
            return themes;
        },
    };
}])
.factory('$wfocus', [function(){
    var focus = true;
    var nextFocusCallbacks = [];
    $(window).focus(function() {
        focus = true;
        for (var i=0; i<nextFocusCallbacks.length; i++) {
            nextFocusCallbacks[i]();
        }
        nextFocusCallbacks = [];
    });
    
    $(window).blur(function() {
        focus = false;
    });
    
    return {
        isFocus: function() {
            return focus;
        },
        onNextFocus: function(callback) {
            nextFocusCallbacks.push(callback);
        }
    };
}])
.run([function(){
    console.log('AngularJS loaded');
}]);