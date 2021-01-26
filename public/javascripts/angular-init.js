/* global libquassel */
/* global angular */
/* global Favico */
/* global localStorage */
/* global Notification */
/* global $ */

angular.module('quassel', ['ngQuassel', 'ngAria', 'ngSanitize', 'ui.bootstrap', 'dragAndDrop', 'cgNotify', 'luegg.directives'])
.config(['$compileProvider', function ($compileProvider) {
    if (!localStorage.getItem('debug')) {
        $compileProvider.debugInfoEnabled(false);
    }
}])
.factory('$responsive', ['$window', function ($window) {
    return {
        getBreakpoint: function () {
            var w = $window.innerWidth;
            if (w < 768) {
                return 'xs';
            } else if (w < 992) {
                return 'sm';
            } else if (w < 1200) {
                return 'md';
            } else {
                return 'lg';
            }
        }
    };
}])
.factory('$ignore', ['$quassel', function($quassel){
    var IgnoreList = libquassel.ignore.IgnoreList;
    var IgnoreItem = libquassel.ignore.IgnoreItem;
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
            $quassel.core().updateIgnoreListManager(ignoreList.export());
        }
    };
}])
.factory('$highlight', ['$quassel', function($quassel){
    var HighlightRuleManager = libquassel.highlight.HighlightRuleManager;
    var HighlightRule = libquassel.highlight.HighlightRule;
    var highlightRuleManager = new HighlightRuleManager();
    var savedHighlightRuleManager = null;
    var highlightRuleManagerRevision = 0;
    return {
        createRule: function() {
            highlightRuleManager.list.push(new HighlightRule('', false, false, true, false, '', ''));
        },
        deleteRule: function(indice) {
            if (highlightRuleManager.list[indice]) {
                highlightRuleManager.list.splice(indice, 1);
            }
        },
        getManager: function() {
            return highlightRuleManager;
        },
        restoreSavedManager: function() {
            highlightRuleManager = angular.copy(savedHighlightRuleManager);
        },
        setManager: function(obj) {
            highlightRuleManager = obj;
            savedHighlightRuleManager = angular.copy(highlightRuleManager);
        },
        getRevision: function() {
            return highlightRuleManagerRevision;
        },
        incRevision: function() {
            highlightRuleManagerRevision++;
        },
        save: function() {
            savedHighlightRuleManager = angular.copy(highlightRuleManager);
            $quassel.core().updateHighlightRuleManager(highlightRuleManager.export());
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
    
    function has(key) {
        return key in localStorage;
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
    .then(function(response) {
        var data = response.data;
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
            set('securecore', (typeof data.settings.securecore === 'boolean' ? data.settings.securecore : true));
            set('theme', data.settings.theme);
            set('perchathistory', data.settings.perchathistory);
            set('displayfullhostmask', data.settings.displayfullhostmask);
            set('highlightmode', data.settings.highlightmode);
            if (typeof data.settings.emptybufferonswitch === 'number') {
                set('emptybufferonswitch', true);
                set('emptybufferonswitchvalue', data.settings.emptybufferonswitch);
            } else {
                set('emptybufferonswitch', false);
            }
        }
        set('themes', data.themes || ['default', 'darksolarized']);
        $rootScope.$emit('defaultsettings', true);
    }).catch(function(response) {
        $alert.warn("Could not load settings. Check nodejs logs.");
        if (missingKeys) {
            set('host', '');
            set('port', 4242);
            set('initialBacklogLimit', 20);
            set('backlogLimit', 100);
            set('unsecurecore', false);
            set('theme', 'default');
            set('perchathistory',true);
            set('displayfullhostmask', false);
            set('highlightmode', 2);
            set('emptybufferonswitch', false);
        }
        set('themes', ['default', 'darksolarized']);
        $rootScope.$emit('defaultsettings', false);
    });

    return {
        set: set,
        del: del,
        get: get,
        has: has
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
    
    var counter = function() {
        return num;
    };

    return {
        more: more,
        less: less,
        reset: reset,
        counter: counter
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
.factory('$embed', ['$sce', '$http', '$timeout', function($sce, $http, $timeout) {
  // Inspired by https://github.com/glowing-bear/glowing-bear/blob/master/js/plugins.js
  // and https://github.com/ritz078/ng-embed
  var options = {
    image:       { embed: true },
    audio:       { embed: true },
    video:       { embed: true },
    code:        { embed: true },
    youtube:     { embed: true, theme: 'dark' },
    twitter:     { embed: true },
    twitch:      { embed: true },
    dailymotion: { embed: true },
    ted:         { embed: true },
    soundcloud:  { embed: true, themeColor: 'f50000' },
    spotify:     { embed: true },
    codepen:     { embed: true },
    jsfiddle:    { embed: true },
    jsbin:       { embed: true },
    plunker:     { embed: true },
    gist:        { embed: true },
    ideone:      { embed: true }
  };
  
  function init() {
    window.twttr = (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0],
        t = window.twttr || {};
      if (d.getElementById(id)) return t;
      js = d.createElement(s);
      js.id = id;
      js.src = "https://platform.twitter.com/widgets.js";
      fjs.parentNode.insertBefore(js, fjs);
    
      t._e = [];
      t.ready = function(f) {
        t._e.push(f);
      };
    
      return t;
    }(document, "script", "twitter-wjs"));
    
    window.twttr.ready(function (twttr) {
      twttr.events.bind('rendered', function (event) {
        setTimeout(function() {
          // Height is sometime set to 0, but it shouldn't
          event.target.style.height = "";
        }, 1);
      });
    });
  }
  
  function Plugin(category, id, regex, getHtml) {
    this.category = category;
    this.id = id;
    this.regex = regex;
    this.getHtml = getHtml;
  }
  
  Plugin.prototype.exec = function(subject) {
    var x = this.regex.exec(subject);
    this.regex.lastIndex = 0;
    return x;
  };
  
  function plugins() {
    var plugins = [];
    if (options.video.embed) {
      plugins.push(new Plugin('video', 'html5-video', /https?:\/\/\S*\.(?:ogv|webm|mp4|gifv)\b/i, function(match) {
        // html5
        var el = angular.element('<video controls></video>')
                  .attr('src', match[0]);
        return $sce.trustAsHtml(el.prop('outerHTML'));
      }));
      
      if (options.youtube.embed) {
        plugins.push(new Plugin('video', 'youtube', /(?:youtube\.com|youtu\.be)\/(?:v\/|embed\/|watch(?:\?v=|\/))?([a-zA-Z0-9_-]+)/, function(match) {
          // youtube
          var embedurl = "https://www.youtube.com/embed/" + match[1] + "?html5=1&iv_load_policy=3&modestbranding=1&rel=0&showinfo=0&autoplay=0";
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('width', '560')
                   .attr('height', '315')
                   .attr('frameborder', '0')
                   .attr('allowfullscreen', 'true');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      if (options.twitch.embed) {
        plugins.push(new Plugin('video', 'twitch', /www\.twitch\.tv\/([a-zA_Z0-9_]+)/, function(match) {
          // twitch
          var embedurl = "https://player.twitch.tv/?channel=" + match[1];
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('width', '560')
                   .attr('height', '315')
                   .attr('frameborder', '0')
                   .attr('allowfullscreen', 'true');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      if (options.dailymotion.embed) {
        plugins.push(new Plugin('video', 'dailymotion', /(?:dailymotion\.com\/.*video|dai\.ly)\/([^_?# ]+)/, function(match) {
          // dailymotion
          var embedurl = 'https://www.dailymotion.com/embed/video/' + match[1] + '?html&controls=html&startscreen=html&info=0&logo=0&related=0';
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('width', '480')
                   .attr('height', '270')
                   .attr('frameborder', '0');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      if (options.ted.embed) {
        plugins.push(new Plugin('video', 'ted', /ted\.com\/talks\/([a-zA-Z0-9_]+)/, function(match) {
          // ted
          var embedurl = 'https://embed.ted.com/talks/' + match[1] + '.html';
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('width', '480')
                   .attr('height', '270')
                   .attr('frameborder', '0');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
    }
    
    if (options.audio.embed) {
      if (options.soundcloud.embed) {
        plugins.push(new Plugin('audio', 'soundcloud', /soundcloud\.com\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+/, function(match) {
          // soundcloud
          var embedurl = 'https://w.soundcloud.com/player/?url=https://' + match[0] + '&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false&download=false&color=' + options.soundcloud.themeColor + '&theme_color=' + options.soundcloud.themeColor;
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('height', '160')
                   .attr('scrolling', 'no')
                   .attr('frameborder', '0');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      if (options.spotify.embed) {
        plugins.push(new Plugin('audio', 'spotify', /open\.spotify\.com\/(?:track|artist|user\/\w+\/playlist)\/[a-zA-Z-0-9]{22}/, function(match) {
          // spotify
          var embedurl = 'https://embed.spotify.com/?uri=' + match[0];
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('width', '350')
                   .attr('height', '80')
                   .attr('frameborder', '0')
                   .attr('allowtransparency', 'true');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      plugins.push(new Plugin('audio', 'html5-audio', /https?:\/\/\S*\.(?:wav|mp3|ogg)\b/i, function(match) {
        // html5
        var el = angular.element('<audio controls></video>')
                 .attr('src', match[0]);
        return $sce.trustAsHtml(el.prop('outerHTML'));
      }));
    }
    
    if (options.image.embed) {
      plugins.push(new Plugin('image', 'image', /https?:\/\/\S*\.(?:gif|jpg|jpeg|tiff|png|svg|webp)\b/i, function(match) {
        // html
        var el = angular.element('<img/>')
                 .attr('src', match[0]);
        return $sce.trustAsHtml(el.prop('outerHTML'));
      }));
    }
    
    if (options.code.embed) {
      if (options.codepen.embed) {
        plugins.push(new Plugin('code', 'codepen', /https?:\/\/codepen\.io\/([A-Za-z0-9_]+)\/pen\/([A-Za-z0-9_]+)/, function(match) {
          // codepen
          var embedurl = 'https://codepen.io/' + match[1] + '/embed/' + match[2] + '/?height=300';
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('height', '300')
                   .attr('allowtransparency', 'true')
                   .attr('allowfullscreen', 'true')
                   .attr('frameborder', '0');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      if (options.jsfiddle.embed) {
        plugins.push(new Plugin('code', 'jsfiddle', /jsfiddle\.net\/[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/, function(match) {
          // jsfiddle
          var embedurl = 'https://' + match[0] + '/embedded';
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('height', '300')
                   .attr('frameborder', '0');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      if (options.jsbin.embed) {
        plugins.push(new Plugin('code', 'jsbin', /jsbin\.com\/[a-zA-Z0-9_]+\/[0-9_]+/, function(match) {
          // jsbin
          var embedurl = 'https://' + match[0] + '/embed?html,js,output';
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('height', '300')
                   .attr('frameborder', '0');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      if (options.plunker.embed) {
        plugins.push(new Plugin('code', 'plunker', /plnkr\.co\/edit\/([a-zA-Z0-9\?=]+)/, function(match) {
          // plunker
          var idMatch = match[1].indexOf('?') === -1 ? match[1] : match[1].split('?')[0];
          var embedurl = 'https://embed.plnkr.co/' + idMatch;
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('height', '480')
                   .attr('frameborder', '0');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
      
      if (options.gist.embed) {
        plugins.push(new Plugin('code', 'gist', /^(https:\/\/gist\.github\.com\/(?:.*?))[\/]?(?:\#.*)?$/i, function(match, next) {
          // gist
          var url = $sce.trustAsResourceUrl(match[1] + '.json');
          $http.jsonp(url, {jsonpCallbackParam: 'callback'}).then(function(d) {
            // Add the gist stylesheet only once
            if (!document.getElementById('gistcss')) {
              var el = angular.element('<link></link>')
                   .attr('rel', 'stylesheet')
                   .attr('href', d.data.stylesheet)
                   .attr('id', 'gistcss');
              angular.element('head').append(el);
            }
            next($sce.trustAsHtml(d.data.div));
          });
        }));
      }
      
      if (options.ideone.embed) {
        plugins.push(new Plugin('code', 'ideone', /ideone\.com\/(?:fork\/)?([a-zA-Z0-9]{6})/, function(match) {
          // ideone
          var embedurl = 'https://ideone.com/embed/' + match[1];
          var el = angular.element('<iframe></iframe>')
                   .attr('src', embedurl)
                   .attr('height', '300')
                   .attr('frameborder', '0');
          return $sce.trustAsHtml(el.prop('outerHTML'));
        }));
      }
    }
    
    if (options.twitter.embed) {
      plugins.push(new Plugin('twitter', 'twitter', /^https?:\/\/twitter\.com\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/, function(match, next) {
        // twitter
        var url = $sce.trustAsResourceUrl('https://api.twitter.com/1.1/statuses/oembed.json?omit_script=true&id=' + match[2] + '&maxwidth=550');
        $http.jsonp(url, {jsonpCallbackParam: 'callback'}).then(function(d) {
          next($sce.trustAsHtml(d.data.html));
          $timeout(function() {
            window.twttr.widgets.load();
          }, 10);
        });
      }));
    }
    
    return plugins;
  }
  var all_plugins = plugins();
  
  function exec(getHtml, match, next) {
    var res = null;
    res = getHtml(match, next);
    if (res) {
      next(res);
    }
  }
  
  function getPluginAndMatch(subject) {
    var x = null;
    for (var i=0; i<all_plugins.length; i++) {
      x = all_plugins[i].exec(subject);
      if (x) return [all_plugins[i], x];
    }
    return;
  }
  
  return {
    getPluginAndMatch: getPluginAndMatch,
    exec: exec,
    init: init
  };
}])
.run(['$embed', function($embed){
  $embed.init();
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
