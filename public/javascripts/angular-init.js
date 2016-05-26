/* global angular */
/* global Favico */
/* global localStorage */
/* global Notification */
/* global $ */

angular.module('quassel', ['ngQuassel', 'ngAria', 'ngSanitize', 'ui.bootstrap', 'dragAndDrop', 'cgNotify'])
.config(['$compileProvider', function ($compileProvider) {
    if (!localStorage.getItem('debug')) {
        $compileProvider.debugInfoEnabled(false);
    }
}])
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
            $quassel.requestUpdateIgnoreListManager(ignoreList.export());
        }
    };
}])
.factory('$config', ['$rootScope', '$http', '$alert', function($rootScope, $http, $alert){

    function set(key, val, raw) {
        localStorage.setItem(key, raw ? val : JSON.stringify(val));
        if (keys[key]) {
            for (var x in keys[key]) {
                keys[key][x](val);
            }
        }
        $rootScope.$emit('config.'+key, val);
    }
    
    function del(key) {
        localStorage.removeItem(key);
    }
    
    function get(key, defval, raw) {
        var myitem = localStorage.getItem(key);
        if (myitem === null) return defval;
        try {
            return raw ? myitem : JSON.parse(myitem);
        } catch (e) {
            console.log(e);
            localStorage.removeItem(key);
        }
        return null;
    }

    var keys = {};
    var configurationKeys = ['initialBacklogLimit', 'backlogLimit', 'securecore', 'theme', 'themes'];
    var ind;
    var missingKeys = false;
    for (var ind in configurationKeys) {
        if (localStorage.getItem(configurationKeys[ind]) === null) {
            missingKeys = true;
            break;
        }
    }
    $http.get("settings")
    .success(function(data, status) {
        if (localStorage.length > 0 && data.version !== get('version')) {
            $alert.warn("Local settings replaced by default settings (new version)");
            localStorage.clear();
            missingKeys = true;
            set('version', data.version);
        }
        if (missingKeys) {
            set('host', data.settings.host);
            set('port', data.settings.port);
            set('initialBacklogLimit', data.settings.initialBacklogLimit);
            set('backlogLimit', data.settings.backlogLimit);
            set('securecore', data.settings.securecore || true);
            set('theme', data.settings.theme);
        }
        set('themes', data.themes || ['default', 'darksolarized']);
        $rootScope.$emit('defaultsettings', true);
    }).error(function(data, status) {
        $alert.warn("Could not load settings. Check nodejs logs.");
        if (missingKeys) {
            set('host', '');
            set('port', 4242);
            set('initialBacklogLimit', 20);
            set('backlogLimit', 100);
            set('unsecurecore', false);
            set('theme', 'default');
        }
        set('themes', ['default', 'darksolarized']);
        $rootScope.$emit('defaultsettings', false);
    });

    return {
        set: set,
        del: del,
        get: get
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
.factory('$theme', ['$config', function($config){
    return {
        getClientTheme: function() {
            return $config.get('theme', null);
        },
        setClientTheme: function(theme) {
            $config.set('theme', theme);
        },
        getAllThemes: function() {
            return $config.get('themes');
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
.factory('$hiddendiv', [function(){
    var hd = $('<div/>').appendTo('body').hide();
    return {
        get: function() {
            return hd;
        }
    };

}])
.factory('$mirc', ['$hiddendiv', function($hiddendiv){

    var color;
    var mapIndColor = [];
    var mapColorInd = {};
    var transparent = null;
    var bold = null;
    var italic = null;
    var underline = null;

    function populate() {
        var i = 0;
        for (; i<15; i++) {
            color = $hiddendiv.get().removeClass().addClass('mirc-fg-' + i).css('color');
            mapIndColor[i] = color;
            mapColorInd[color] = i;
        }
        transparent = $hiddendiv.get().removeClass().addClass('mirc-bg-transparent').css('background-color');
        bold = $hiddendiv.get().removeClass().addClass('mirc-bold').css('font-weight');
        italic = $hiddendiv.get().removeClass().addClass('mirc-italic').css('font-style');
        underline = $hiddendiv.get().removeClass().addClass('mirc-underline').css('text-decoration');
    }
    populate();

    return {
        getColorByMIRCInd: function(ind) {
            if (!(ind in mapIndColor)) return false;
            return mapIndColor[ind];
        },
        getMIRCValidColor: function(color) {
            if (transparent === color) return false;
            if (!(color in mapColorInd)) return false;
            return color;
        },
        getMIRCIndByColor: function(color) {
            if (!(color in mapColorInd)) return false;
            return mapColorInd[color];
        },
        isBold: function(value) {
            if (typeof value === "string") {
                return value.indexOf(bold) !== -1;
            }
            return false;
        },
        isItalic: function(value) {
            if (typeof value === "string") {
                return value.indexOf(italic) !== -1;
            }
            return false;
        },
        isUnderline: function(value) {
            if (typeof value === "string") {
                return value.indexOf(underline) !== -1;
            }
            return false;
        }
    };
}])
.run([function(){
    console.log('AngularJS loaded');
}]);

// Production steps of ECMA-262, Edition 6, 22.1.2.1
// Reference: https://people.mozilla.org/~jorendorff/es6-draft.html#sec-array.from
if (!Array.from) {
  Array.from = (function () {
    var toStr = Object.prototype.toString;
    var isCallable = function (fn) {
      return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
    };
    var toInteger = function (value) {
      var number = Number(value);
      if (isNaN(number)) { return 0; }
      if (number === 0 || !isFinite(number)) { return number; }
      return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
    };
    var maxSafeInteger = Math.pow(2, 53) - 1;
    var toLength = function (value) {
      var len = toInteger(value);
      return Math.min(Math.max(len, 0), maxSafeInteger);
    };

    // The length property of the from method is 1.
    return function from(arrayLike/*, mapFn, thisArg */) {
      // 1. Let C be the this value.
      var C = this;

      // 2. Let items be ToObject(arrayLike).
      var items = Object(arrayLike);

      // 3. ReturnIfAbrupt(items).
      if (arrayLike == null) {
        throw new TypeError("Array.from requires an array-like object - not null or undefined");
      }

      // 4. If mapfn is undefined, then let mapping be false.
      var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
      var T;
      if (typeof mapFn !== 'undefined') {
        // 5. else
        // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
        if (!isCallable(mapFn)) {
          throw new TypeError('Array.from: when provided, the second argument must be a function');
        }

        // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (arguments.length > 2) {
          T = arguments[2];
        }
      }

      // 10. Let lenValue be Get(items, "length").
      // 11. Let len be ToLength(lenValue).
      var len = toLength(items.length);

      // 13. If IsConstructor(C) is true, then
      // 13. a. Let A be the result of calling the [[Construct]] internal method of C with an argument list containing the single item len.
      // 14. a. Else, Let A be ArrayCreate(len).
      var A = isCallable(C) ? Object(new C(len)) : new Array(len);

      // 16. Let k be 0.
      var k = 0;
      // 17. Repeat, while k < len… (also steps a - h)
      var kValue;
      while (k < len) {
        kValue = items[k];
        if (mapFn) {
          A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
        } else {
          A[k] = kValue;
        }
        k += 1;
      }
      // 18. Let putStatus be Put(A, "length", len, true).
      A.length = len;
      // 20. Return A.
      return A;
    };
  }());
}
