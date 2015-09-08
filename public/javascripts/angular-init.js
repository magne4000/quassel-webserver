angular.module('quassel', ['ngQuassel', 'ngSanitize', 'ui.bootstrap', 'dragAndDrop', 'cgNotify'])
.factory('$ignore', ['$quassel', function($quassel){
    var IgnoreList = require('ignore').IgnoreList;
    var IgnoreItem = require('ignore').IgnoreItem;
    var ignoreList = new IgnoreList();
    var savedIgnoreList = null;
    var ignoreListRevision = 0;
    return {
        createItem: function() {
            ignoreList.list.push(new IgnoreItem(1, '', 0, 0, 1, 0, 'rule'));
        },
        deleteItem: function(indice) {
            if (ignoreList.list[indice]) {
                ignoreList.list.splice(indice, 1);
            }
        },
        getList: function() {
            return ignoreList;
        },
        restoreSavedList: function() {
            ignoreList = angular.copy(savedIgnoreList);
        },
        setList: function(obj) {
            ignoreList = obj;
            savedIgnoreList = angular.copy(ignoreList);
        },
        getRevision: function() {
            return ignoreListRevision;
        },
        incRevision: function() {
            ignoreListRevision++;
        },
        save: function() {
            savedIgnoreList = angular.copy(ignoreList);
            $quassel.requestUpdate(ignoreList.export());
        }
    };
}])
.factory('$config', ['$rootScope', function($rootScope){
    
    var keys = {};
    
    return {
        set: function(key, val) {
            localStorage.setItem(key, JSON.stringify(val));
            if (keys[key]) {
                for (var x in keys[key]) {
                    keys[key][x](val);
                }
            }
            $rootScope.$emit('config.'+key, val);
        },
        get: function(key) {
            return JSON.parse(localStorage.getItem(key));
        }
    };
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
    
    return function(title, body, timeout){
        if (granted) {
            var options = {};
            timeout = timeout || 5000;
            if (body) options.body = body;
            var notif = new Notification(title, options);
            setTimeout(function(){
                if (notif) {
                    notif.close();
                }
            }, timeout);
            return notif;
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
    var nextFocusCallback = null;
    $(window).focus(function() {
        focus = true;
        if (nextFocusCallback !== null)
            nextFocusCallback();
        nextFocusCallback = null;
    });
    
    $(window).blur(function() {
        focus = false;
    });
    
    return {
        isFocus: function() {
            return focus;
        },
        onNextFocus: function(callback) {
            nextFocusCallback = callback;
        }
    };
}])
.run([function(){
    console.log('AngularJS loaded');
}]);