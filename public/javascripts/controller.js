var myModule = angular.module('quassel', ['ngSocket', 'ngSanitize', 'er']);

myModule.directive('input', function ($parse) {
    return {
        restrict: 'E',
        require: '?ngModel',
        link: function (scope, element, attrs) {
            if (attrs.ngModel && attrs.value) {
                $parse(attrs.ngModel).assign(scope, attrs.value);
            }
        }
    };
});

myModule.config(["$socketProvider", function ($socketProvider) {
    $socketProvider.setOptions({
        timeout: 6000,
        reconnectionAttempts: 5
    });
}]);

myModule.factory('$networks', function(){
    var networks = null;
    
    return {
        get: function() {
            return networks;
        },
        set: function(obj) {
            networks = obj;
        }
    };
});

myModule.factory('$reviver', [function(){
    var NetworkCollection = require('network').NetworkCollection;
    var Network = require('network').Network;
    var IRCMessage = require('message').IRCMessage;
    var IRCBufferCollection = require('buffer').IRCBufferCollection;
    var IRCBuffer = require('buffer').IRCBuffer;
    var IRCUser = require('user');
    var HashMap = require('serialized-hashmap');
    var Reviver = require('serializer').Reviver;
    var reviver = new Reviver(NetworkCollection, Network, IRCBufferCollection, IRCBuffer, IRCUser, HashMap, IRCMessage);
    
    return reviver;
}]);

myModule.filter('decoratenick', ['stripnickFilter', function(stripnick) {
    var MT = require('message').Type;
    
    return function(message) {
        var sender;
        switch(message.type) {
            case MT.Nick:
                sender = '<->';
                break;
            case MT.Mode:
                sender = '***';
                break;
            case MT.Join:
                sender = '-->';
                break;
            case MT.Part:
                sender = '<--';
                break;
            case MT.Quit:
                sender = '<--';
                break;
            case MT.Kick:
                sender = '<-*';
                break;
            case MT.Server:
                sender = stripnick(message.sender) || "*";
                break;
            case MT.Topic:
                sender = '*';
                break;
            case MT.NetsplitJoin:
                sender = '=>';
                break;
            case MT.NetsplitQuit:
                sender = '<=';
                break;
            default:
                sender = stripnick(message.sender);
        }
        return sender;
    };
}]);

myModule.filter('decoratecontent', ['stripnickFilter', 'linkyFilter', function(stripnick, linky) {
    var MT = require('message').Type;
    
    return function(message) {
        var content;
        switch(message.type) {
            case MT.Plain:
                content = linky(message.content, '_blank');
                break;
            case MT.Nick:
                content = stripnick(message.sender) + " is now known as " + message.content;
                break;
            case MT.Mode:
                content = "Mode " + message.content + " by " + stripnick(message.sender);
                break;
            case MT.Join:
                content = stripnick(message.sender) + " has joined";
                break;
            case MT.Part:
                content = stripnick(message.sender) + " has left";
                break;
            case MT.Quit:
                content = stripnick(message.sender) + " has quit";
                break;
            case MT.Kick:
                var ind = message.content.indexOf(" ");
                content = stripnick(message.sender) + " has kicked " + message.content.slice(0, ind) + " (" + message.content.slice(ind+1) + ")";
                break;
            default:
                content = message.content;
        }
        return content;
    };
}]);

myModule.filter('channelsFilter', function() {
    return function(input) {
        input = input || [];
        var out = input.filter(function(elt){
            return !elt.isStatusBuffer();
        });
        out.sort(function(a, b){
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        
        return out;
    };
});

myModule.filter('stripnick', function() {
    return function(input) {
        if (typeof input === 'string') {
            var ind = input.indexOf('!');
            if (ind !== -1) {
                return input.slice(0, ind);
            }
            return input;
        }
        return '';
    };
});

myModule.filter('duration', function() {
    return function(input) {
        var dateObject = null;
        if (input instanceof Date) {
            dateObject = input;
        } else {
            dateObject = new Date(input);
        }
        var h = dateObject.getHours(), m = dateObject.getMinutes(), s = dateObject.getSeconds();
        if (h < 10) h = '0'+h;
        if (m < 10) m = '0'+m;
        if (s < 10) s = '0'+s;
        return [h, m, s].join(':');
    };
});

myModule.filter('color', function() {
    var COLOR = new RegExp("^" + String.fromCharCode(3) + "(([0-9]{1,2})(,([0-9]{1,2}))?)");
    return function(input) {
        var out = '',
        nbSpan = 0,
        nbSpanColor = 0,
        spanAttributes = {
            bold: false,
            italic: false,
            underline: false
        },
        i = 0,
        match;
    
        var openSpan = function (classes) {
            nbSpan += 1;
            return '<span class="' + classes + '">';
        };
    
        var openColorSpan = function (fgclass, bgclass) {
            nbSpanColor += 1;
            var classes = fgclass;
            if (bgclass) {
                classes += ' ' + bgclass;
            }
            return openSpan(classes);
        };
    
        var closeSpan = function () {
            nbSpan -= 1;
            return '</span>';
        };
    
        var closeColorSpan = function () {
            nbSpanColor -= 1;
            return closeSpan();
        };
    
        for (i = 0; i < input.length; i++) {
            switch (input[i]) {
                case '\x02':
                    if (spanAttributes.bold) {
                        out += closeSpan();
                    } else {
                        out += openSpan('mirc-bold');
                    }
                    spanAttributes.bold = !spanAttributes.bold;
                    break;
                case '\x1D':
                    if (spanAttributes.italic) {
                        out += closeSpan();
                    } else {
                        out += openSpan('mirc-italic');
                    }
                    spanAttributes.italic = !spanAttributes.italic;
                    break;
                case '\x1F':
                    if (spanAttributes.underline) {
                        out += closeSpan();
                    } else {
                        out += openSpan('mirc-underline');
                    }
                    spanAttributes.underline = !spanAttributes.underline;
                    break;
                case '\x03':
                    match = input.substr(i, 6).match(COLOR);
                    var classfg = false,
                        classbg = false;
                    if (match) {
                        i += match[1].length;
                        // 2 & 4
                        classfg = "mirc-fg-" + parseInt(match[2], 10);
                        if (match[4]) {
                            classbg = "mirc-bg-" + parseInt(match[4], 10);
                        }
                        out += openColorSpan(classfg, classbg);
                    } else {
                        while (nbSpanColor > 0) {
                            out += closeColorSpan();
                        }
                    }
                    break;
                case '\x0F':
                    while (nbSpan > 0) {
                        out += closeSpan();
                    }
                    spanAttributes.bold = spanAttributes.italic = spanAttributes.underline = spanAttributes.colour = false;
                    break;
                default:
                    out += input[i];
                    break;
            }
        }
        while (nbSpan > 0) {
            out += closeSpan();
        }
        return out;
    };
});

myModule.filter('escape', function() {
    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#x27;',
        '/': '&#x2F;'
    }, re = /[&<>]/g;
    return function(input) {
        if (typeof input === 'string') {
            return input.replace(re, function (tag) {
                return tagsToReplace[tag] || tag;
            });
        } else if (typeof input !== 'undefined' && typeof input.content === 'string') {
            var msg = input;
            msg.content = msg.content.replace(re, function (tag) {
                return tagsToReplace[tag] || tag;
            });
            return msg;
        }
        return '';
    };
});

myModule.filter('hash', function() {
    return function(input) {
        if (!input) return null;
        var hash = 0, i, chr, len;
        if (input.length === 0) return hash;
        for (i = 0, len = input.length; i < len; i++) {
            chr   = input.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash) % 16;
    };
});

myModule.controller('NetworkController', ['$scope', '$networks', '$socket', '$er', '$reviver', function($scope, $networks, $socket, $er, $reviver) {
    $scope.networks = {};
    $scope.buffer = null;
    var changesTimeout = [];
    
    $er.setCallback(function(event) {
        $socket.emit('register', event);
    });
    
    // Internal
    $er.on('_init', function(next, data) {
        console.log('_init');
        $scope.$apply(function(){
            $networks.set(data);
            $reviver.reviveAll($networks.get());
            $scope.networks = $networks.get().all();
        });
        next();
    });
    
    // Internal
    $er.on('network._init', function(next, networkId, data) {
        console.log('network._init');
        $reviver.reviveAll(data);
        $networks.get().set(networkId, data);
        $scope.networks = $networks.get().all();
        next();
    }).after('_init');
    
    $er.on('network.init', function(next, networkId) {
        console.log('network.init');
        //var network = networks2.get(networkId);
        //Views.addNetwork(network);
        //$scope.$digest();
        next();
    }).after('network._init');
    
    $er.on('network.addbuffer', function(next, networkId, bufferId) {
        console.log('addbuffer');
    }).after('network.init');
    
    $er.on('change', function(next, networkId, change) {
        if (!jsonpatch.apply($networks.get().get(networkId), change)) {
            console.log('Patch failed!');
        }
        else {
            clearTimeout(changesTimeout[networkId]);
            changesTimeout[networkId] = setTimeout(function() {
                $scope.$apply(function(){
                    $reviver.reviveAll($networks.get().get(networkId));
                    $scope.networks = $networks.get().all();
                });
            }, 100);
        }
        next();
    }).after('network.init');
    
    $scope.showBuffer = function(channel) {
        $scope.buffer = channel;
    };
}]);

myModule.controller('SocketController', ['$scope', '$socket', '$er', function($scope, $socket, $er) {
    $scope.connected = false;
    $scope.logged = false;
    $scope.host = "";
    $scope.port = "";
    $scope.user = "";
    $scope.password = "";
    
    $socket.on('_error', function(e) {
        console.log('ERROR');
        console.log(e);
        switch (e.errno) {
        case 'ECONNREFUSED':
            Views.alert("Connection refused.");
            break;
        default:
            console.log('Unknown error.');
        }
    });
    
    $socket.on("connected", function() {
        console.log('CONNECTED');
        $scope.$apply(function(){
            $scope.connected = true;
        });
    });
    
    $socket.on('reconnect_attempt', function() {
        console.log('RECONNECTING');
        Views.connecting();
    });
    
    $socket.on('reconnect_error', function() {
        console.log('RECONNECTING_ERROR');
        Views.disconnected();
    });
    
    $socket.on('reconnect_failed', function() {
        console.log('RECONNECTING_FAILED');
        Views.disconnected();
    });
    
    $socket.on('loginfailed', function() {
        Views.alert("Invalid username or password.");
    });
    
    $socket.on('login', function() {
        console.log('Logged in');
        $scope.$apply(function(){
            $scope.logged = true;
        });
    });
    
    $scope.login = function(){
        $socket.emit('credentials', {
            server: $scope.host,
            port: $scope.port,
            user: $scope.user,
            password: $scope.password
        });
    };
    
    /*
    $socket.on('disconnect', function() {
        console.log('DISCONNECT');
        $er.clearReceived();
        $scope.$apply(function(){
            $scope.connected = false;
        });
    });
    $socket.on('reconnect', function() {
        console.log('RECONNECT');
        $er.redoCallbacks();
        Views.connected();
        Views.clear();
        connect($socket);
    });
    */
    
}]);

myModule.run([function(){
    console.log('AngularJS loaded');
}]);
