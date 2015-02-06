var myModule = angular.module('quassel', ['ngSocket', 'ngSanitize', 'er', 'ui.bootstrap', 'backlog']);

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

myModule.directive('ngConfirmClick', function(){
    return {
        require: '?ngOkClick',
        link: function (scope, element, attr) {
            var msg = attr.ngConfirmClick;
            var clickAction = attr.ngOkClick;
            element.on('click', function (event) {
                if (window.confirm(msg)) {
                    scope.$apply(clickAction);
                }
            });
        }
    };
});

myModule.directive('toggle', function ($parse) {
    return {
        link: function (scope, element, attrs) {
            element.on('click', function(){
                var eltToToggle = $('#'+attrs.toggle), self = $(this);
                if (self.hasClass('expanded')) {
                    eltToToggle.css("max-height", "0");
                    self.removeClass("expanded").addClass("collapsed");
                } else {
                    eltToToggle.css("max-height", "");
                    self.removeClass("collapsed").addClass("expanded");
                }
            });
        }
    };
});

myModule.directive('caret', function() {
    var MT = require('message').Type;
    
    function setCaretPosition(elem, caretPos) {
        if (elem !== null) {
            if (elem.createTextRange) {
                var range = elem.createTextRange();
                range.move('character', caretPos);
                range.select();
            } else {
                if (elem.selectionStart) {
                    elem.focus();
                    elem.setSelectionRange(caretPos, caretPos);
                } else
                    elem.focus();
            }
        }
    }

    return {
        link: function(scope, element, attrs) {

            element.on('keydown', function($event) {
                if ($event.keyCode == 38) { // Arrow up
                    $event.preventDefault();
                    scope.showPreviousMessage(scope.buffer.id);
                } else if ($event.keyCode == 40) { // Arrow down
                    $event.preventDefault();
                    scope.showNextMessage(scope.buffer.id);
                } else if ($event.keyCode == 9) { // Tab
                    $event.preventDefault();
                    var tokenEnd = element[0].selectionEnd;
                        
                    var message = scope.message;
                    var messageLeft = message.substr(0, tokenEnd);
                    var tokenStart = messageLeft.lastIndexOf(' ');
                    tokenStart += 1; // -1 (not found) => 0 (start)
                    var token = messageLeft.substr(tokenStart);
        
                    // Find the most recent nick who has talked.
                    var getMostRecentNick = function(token) {
                        if (!scope.buffer) return;
        
                        var keys = scope.buffer.messages.keys();
                        keys.sort();
                        keys.reverse();
        
                        for (var i = 0; i < keys.length; i++) {
                            var messageId = keys[i];
                            var message = scope.buffer.messages.get(messageId);
        
                            // Only check Plain and Action messages for nicks.
                            if (!(message.type == MT.Plain || message.type == MT.Action))
                                continue;
        
                            var nick = message.getNick();
                            if (nick.length <= token.length)
                                continue;
        
                            if (token.toLowerCase() == nick.toLowerCase().substr(0, token.length))
                                return nick;
                        }
                    };
        
                    // Find the closet nick alphabetically from the current buffer's nick list.
                    var getNickAlphabetically = function(token) {
                        if (!scope.buffer) return;
        
                        var nicks = Object.keys(scope.buffer.nickUserMap);
                        nicks.sort(function(a, b) {
                            return a.toLowerCase().localeCompare(b.toLowerCase());
                        });
        
                        for (var i = 0; i < nicks.length; i++) {
                            var nick = nicks[i];
                            if (nick.length <= token.length)
                                continue;
        
                            if (token.toLowerCase() == nick.toLowerCase().substr(0, token.length))
                                return nick;
                        }
                    };

                    var getTokenCompletion = function(token) {
                        var nick = getMostRecentNick(token);
                        if (!nick)
                            nick = getNickAlphabetically(token);
                        console.log(nick);
                        if (nick) {
                            if (tokenStart === 0) {
                                return nick + ': ';
                            } else {
                                return nick;
                            }
                        }
                    };
        
                    var newToken = getTokenCompletion(token);
        
                    if (newToken) {
                        var newMessage = message.substr(0, tokenStart) + newToken + message.substr(tokenEnd);
                        scope.$apply(function(){
                            scope.message = newMessage;
                        });
                        var newTokenEnd = tokenEnd + newToken.length - token.length;
                        setCaretPosition(element[0], newTokenEnd);
                    }
                }
            });
            
            
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
        var content, arr, servers;
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
            case MT.NetsplitJoin:
                arr = message.content.split("#:#");
                servers = arr.pop().split(" ");
                content = "Netsplit between " + servers[0] + " and " + servers[1] + " ended. Users joined: " + arr.map(stripnick).join(', ');
                break;
            case MT.NetsplitQuit:
                arr = message.content.split("#:#");
                servers = arr.pop().split(" ");
                content = "Netsplit between " + servers[0] + " and " + servers[1] + ". Users quit: " + arr.map(stripnick).join(', ');
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
            return !elt._isStatusBuffer;
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
        
        var unescapeColorTags = function(str) {
            var tagsToReplace = {
                '&#2;': '\x02',
                '&#29;': '\x1D',
                '&#31;': '\x1F',
                '&#3;': '\x03',
                '&#15;': '\x0F'
            };
            var re = /&#(2|29|3|31|15);/g;
            return str.replace(re, function (tag) {
                return tagsToReplace[tag] || tag;
            });
        };
        
        input = unescapeColorTags(input);
    
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

myModule.filter('usersop', function() {
    return function(input, buffer) {
        var users = [];
        angular.forEach(input, function(value, key) {
            if (buffer.isOp(value.nick)) this.push(value);
        }, users);
        return users;
    };
});

myModule.filter('usersvoiced', function() {
    return function(input, buffer) {
        var users = [];
        angular.forEach(input, function(value, key) {
            if (buffer.isVoiced(value.nick)) this.push(value);
        }, users);
        return users;
    };
});

myModule.filter('usersstd', function() {
    return function(input, buffer) {
        var users = [];
        angular.forEach(input, function(value, key) {
            if (!buffer.isVoiced(value.nick) && !buffer.isOp(value.nick)) this.push(value);
        }, users);
        return users;
    };
});

myModule.controller('NetworkController', ['$scope', '$networks', '$socket', '$er', '$reviver', '$modal', function($scope, $networks, $socket, $er, $reviver, $modal) {
    $scope.networks = {};
    $scope.buffer = null;
    
    var MT = require('message').Type;
    var changesTimeout = [];
    var loadingMoreBacklogs = [];
    
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
        next();
    }).after('network._init');
    
    $er.on('network.addbuffer', function(next, networkId, bufferId) {
        next();
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
    
    $er.on('buffer.backlog', function(next, bufferId, messageIds) {
        if ($scope.buffer !== null) {
            loadingMoreBacklogs[''+$scope.buffer.id] = false;
        }
        next();
    });
    
    $er.on('buffer.lastseen', function(next, bufferId, messageId) {
        messageId = parseInt(messageId, 10);
        var buffer = $networks.get().findBuffer(bufferId);
        if (buffer !== null && !buffer.isLast(messageId) && buffer.messages.has(messageId)) {
            buffer.highlight = 1;
        }
        next();
    }).after('buffer.backlog');
    
    $er.on('buffer.message', function(next, bufferId, messageId) {
        var buffer = $networks.get().findBuffer(bufferId);
        $reviver.afterReviving(buffer.messages, function(obj){
            var message = obj.get(parseInt(messageId, 10));
            if ($scope.buffer !== null && buffer.id === $scope.buffer.id) {
                $socket.emit('markBufferAsRead', bufferId, messageId);
            } else {
                $reviver.afterReviving(message, function(obj2){
                    if (obj2.isHighlighted()) {
                        $scope.$apply(function(){
                            buffer.highlight = 2;
                        });
                    } else if (obj2.type == MT.Plain || obj2.type == MT.Action) {
                        $scope.$apply(function(){
                            buffer.highlight = 1;
                        });
                    }
                });
            }
        });
        next();
    }).after('network.addbuffer');
    
    $er.on('buffer.read', function(next, bufferId) {
        var buffer = $networks.get().findBuffer(bufferId);
        buffer.highlight = 0;
        next();
    }).after('network.addbuffer');
    
    $scope.showBuffer = function(channel) {
        $scope.buffer = channel;
        var id = 0;
        channel.messages.forEach(function(val, key) {
            if (val.id > id) id = val.id;
        });
        
        $socket.emit('markBufferAsRead', channel.id, id);
    };
    
    $scope.loadMore = function() {
        if ($scope.buffer !== null && (typeof loadingMoreBacklogs[''+$scope.buffer.id] === 'undefined' || loadingMoreBacklogs[''+$scope.buffer.id] === false)) {
            var firstMessage = Math.min.apply(null, $scope.buffer.messages.keys());
            loadingMoreBacklogs[''+$scope.buffer.id] = true;
            $socket.emit('moreBacklogs', $scope.buffer.id, firstMessage);
            return true;
        }
        return false;
    };
    
    $scope.connect = function(network) {
        $socket.emit('requestConnectNetwork', network.networkId);
    };
    
    $scope.disconnect = function(network) {
        $socket.emit('requestDisconnectNetwork', network.networkId);
    };
    
    $scope.openModalJoinChannel = function(network) {
        var modalInstance = $modal.open({
            templateUrl: 'modalJoinChannel.html',
            controller: 'ModalJoinChannelInstanceCtrl'
        });
    
        modalInstance.result.then(function (name) {
            $socket.emit('sendMessage', network.getStatusBuffer().id, '/join ' + name);
        });
      };
}]);

myModule.controller('ModalJoinChannelInstanceCtrl', function ($scope, $modalInstance) {
    $scope.name = '';
    
    $scope.ok = function () {
        $modalInstance.close($scope.name);
    };
    
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});

myModule.controller('SocketController', ['$scope', '$socket', '$er', '$timeout', '$window', function($scope, $socket, $er, $timeout, $window) {
    $scope.disconnected = false;
    $scope.connecting = false;
    $scope.firstconnected = false;
    $scope.logged = false;
    $scope.host = "";
    $scope.port = "";
    $scope.user = "";
    $scope.password = "";
    $scope.alert = "";
    
    $scope.$watch('alert', function(newValue, oldValue) {
        if (newValue !== "") {
            $timeout(function(){
                $scope.alert = "";
            }, 8000);
        }
    });
    
    $socket.on('_error', function(e) {
        console.log('ERROR');
        console.log(e);
        switch (e.errno) {
        case 'ECONNREFUSED':
            $scope.$apply(function(){
                $scope.alert = "Connection refused.";
            });
            break;
        default:
            console.log('Unknown error.');
        }
    });
    
    $socket.on("connected", function() {
        console.log('CONNECTED');
        $scope.$apply(function(){
            $scope.disconnected = false;
            $scope.connecting = false;
            $scope.firstconnected = true;
        });
    });
    
    $socket.on('reconnect_attempt', function() {
        console.log('RECONNECTING');
        $scope.$apply(function(){
            $scope.connecting = true;
        });
    });
    
    $socket.on('reconnect_error', function() {
        console.log('RECONNECTING_ERROR');
        $scope.$apply(function(){
            $scope.connecting = false;
        });
    });
    
    $socket.on('reconnect_failed', function() {
        console.log('RECONNECTING_FAILED');
        $scope.$apply(function(){
            $scope.connecting = false;
            $scope.disconnected = true;
        });
    });
    
    $socket.on('loginfailed', function() {
        console.log('loginfailed');
        $scope.$apply(function(){
            $scope.alert = "Invalid username or password.";
        });
    });
    
    $socket.on('login', function() {
        console.log('Logged in');
        $scope.$apply(function(){
            $scope.logged = true;
        });
    });
    
    $socket.on('disconnect', function() {
        console.log('DISCONNECT');
        $er.clearReceived();
        $scope.$apply(function(){
            $scope.disconnected = true;
        });
    });
    
    $socket.on('reconnect', function() {
        console.log('RECONNECT');
        $er.redoCallbacks();
        if ($scope.logged) {
            $scope.login();
        }
        $scope.$apply(function(){
            $scope.disconnected = false;
        });
    });
    
    $scope.reload = function(){
        $window.location.reload();
    };
    
    $scope.login = function(){
        $socket.emit('credentials', {
            server: $scope.host,
            port: $scope.port,
            user: $scope.user,
            password: $scope.password
        });
    };
}]);

myModule.controller('InputController', ['$scope', '$socket', function($scope, $socket) {
    var messagesHistory = [];
    var MT = require('message').Type;
    
    $scope.message = '';
    
    var CircularBuffer = function(length){
        this.wpointer = 0;
        this.rpointer = 0;
        this.lrpointer = null;
        this.buffer = [];
        this.max = length;
    };
    
    CircularBuffer.prototype.push = function(item){
        this.buffer[this.wpointer] = item;
        this.wpointer = (this.max + this.wpointer + 1) % this.max;
        this.rpointer = this.wpointer;
    };
    
    CircularBuffer.prototype._previous = function(){
        if (this.buffer.length === this.max) {
            if (this.wpointer === this.max - 1) {
                if (this.rpointer === 0) return false;
            } else if (this.rpointer === this.wpointer && this.lrpointer !== null) {
                return false;
            }
        } else if (this.rpointer === 0) return false;
        this.lrpointer = this.rpointer;
        this.rpointer -= 1;
        if (this.rpointer < 0) this.rpointer = this.buffer.length - 1;
        return true;
    };
    
    CircularBuffer.prototype.previous = function(){
        if (this.buffer.length === 0) return null;
        if (this._previous()) {
            return this.buffer[this.rpointer];
        }
        return null;
    };
    
    CircularBuffer.prototype._next = function(key){
        var ret = true;
        if (this.buffer.length === this.max) {
            if (this.lrpointer === null) {
                ret = false;
            } else if (this.wpointer === 0) {
                if (this.rpointer === this.max - 1) ret = false;
            } else if (this.rpointer + 1 === this.wpointer) {
                ret = false;
            }
        } else if (this.rpointer === this.wpointer || this.rpointer === this.wpointer - 1) ret = false;
        if (!ret) {
            this.lrpointer = null;
            return false;
        }
        this.lrpointer = this.rpointer;
        this.rpointer += 1;
        if (this.rpointer >= this.buffer.length) this.rpointer = 0;
        return true;
    };
    
    CircularBuffer.prototype.next = function(){
        if (this.buffer.length === 0) return null;
        if (this._next()) {
            return this.buffer[this.rpointer];
        }
        return null;
    };
    
    CircularBuffer.prototype.clearReadPointer = function(){
        this.rpointer = this.wpointer - 1;
        if (this.rpointer < 0) this.rpointer = this.buffer.length - 1;
        this.lrpointer = null;
    };
    
    $scope.addMessageHistory = function(message, bufferId) {
        if (typeof messagesHistory[''+bufferId] === 'undefined') messagesHistory[''+bufferId] = new CircularBuffer(50);
        messagesHistory[''+bufferId].push(message);
    };

    $scope.clearMessageHistory = function(bufferId) {
        if (typeof messagesHistory[''+bufferId] !== 'undefined') {
            messagesHistory[''+bufferId].clearReadPointer();
        }
    };
    
    $scope.showPreviousMessage = function(bufferId) {
        if (typeof messagesHistory[''+bufferId] !== 'undefined') {
            var msg = messagesHistory[''+bufferId].previous();
            if (msg !== null) {
                $("#messagebox").val(msg);
            }
        }
    };

    $scope.showNextMessage = function(bufferId) {
        if (typeof messagesHistory[''+bufferId] !== 'undefined') {
            var msg = messagesHistory[''+bufferId].next();
            if (msg !== null) {
                $("#messagebox").val(msg);
            }
        }
    };
    
    $scope.sendMessage = function() {
        if (typeof $scope.buffer.id === "number" && $scope.message.length > 0) {
            $scope.clearMessageHistory($scope.buffer.id);
            $socket.emit('sendMessage', $scope.buffer.id, $scope.message);
            $scope.addMessageHistory($scope.message, $scope.buffer.id);
            $scope.message = '';
        }
    };
}]);

myModule.controller('FilterController', ['$scope', function($scope) {
    var filters = [
        {label: 'Join', type: 32, value: false},
        {label: 'Part', type: 64, value: false},
        {label: 'Quit', type: 128, value: false},
        {label: 'Nick', type: 8, value: false},
        {label: 'Mode', type: 16, value: false},
        {label: 'Topic', type: 16384, value: false},
        {label: 'DayChange', type: 8192, value: false},
    ];
    var bufferFilters = [];
    $scope.currentFilter = [];
    $scope.currentFilter2 = {};
    $scope.defaultFilter = filters;
    
    $scope.$watch('buffer', function(newValue, oldValue) {
        if (oldValue !== null) {
            bufferFilters[''+oldValue.id] = angular.copy($scope.currentFilter);
        }
        if ((newValue !== null && oldValue === null) || (newValue !== null && oldValue !== null && newValue.id !== oldValue.id)) {
            if (typeof bufferFilters[''+newValue.id] === 'undefined') {
                bufferFilters[''+newValue.id] = angular.copy($scope.defaultFilter);
            }
            $scope.currentFilter = bufferFilters[''+newValue.id];
        }
    });
    
    $scope.$watch('currentFilter', function(newValue, oldValue) {
        angular.forEach($scope.currentFilter, function(value, key) {
            $scope.currentFilter2[''+value.type] = value.value;
        });
    }, true);
    
    $scope.setAsDefault = function() {
        $scope.defaultFilter = angular.copy($scope.currentFilter);
    };
    
    $scope.useDefault = function() {
        $scope.currentFilter = angular.copy($scope.defaultFilter);
    };
}]);

myModule.run([function(){
    console.log('AngularJS loaded');
}]);
