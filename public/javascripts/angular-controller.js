/* global angular */

angular.module('quassel')
.controller('NetworkController',
        ['$scope', '$quassel', '$uibModal', '$favico', '$alert', '$desktop', '$wfocus', '$ignore', '$config',
            function($scope, $quassel, $uibModal, $favico, $alert, $desktop, $wfocus, $ignore, $config) {
    $scope.networks = [];
    $scope.buffer = null;
    $scope.messages = [];
    $scope.showhidden = false;

    var MT = require('message').Type;
    var MF = require('message').Flag;
    var IRCMessage = require('message').IRCMessage;
    var loadingMoreBacklogs = [];
    var initialLastSeenList = [];

    function createDayChangeMessage(msg, timestamp) {
        var message = new IRCMessage({
            id: msg.id,
            timestamp: timestamp/1000,
            type: MT.DayChange,
            flags: MF.ServerMsg,
            bufferInfo: {
                network: msg.networkId,
                id: msg.bufferId
            }
        });
        message.__s_done = true;
        message.sid = msg.id+timestamp;
        return message;
    }

    function updateMessages() {
        if ($scope.buffer) {
            var messages = $scope.buffer.messages.values();
            $scope.messages = insertDayChangeMessagesAndApplyIgnoreList(messages, $scope.buffer);
            $scope.buffer.ignoreListRevision = $ignore.getRevision();
        }
    }

    function isIgnored(message, buffer) {
        var shouldDelete = false;
        if (buffer.ignoreListRevision === $ignore.getRevision() && typeof message.isIgnored === "boolean") {
            shouldDelete = message.isIgnored;
        } else if ($ignore.getList().matches(message, $quassel.get().getNetworks())) {
            message.isIgnored = true;
            shouldDelete = true;
        } else {
            message.isIgnored = false;
        }
        return shouldDelete;
    }

    function insertDayChangeMessagesAndApplyIgnoreList(messages, buffer) {
        var i, j, lastMessageDay, lastMessage, currentMessageDay, currentMessage,
            interval, today = new Date().setHours(0, 0, 0, 0);
        // Sort by id
        messages.sort(function(a, b){
            return a.id - b.id;
        });
        // Add missing DayChange messages between existing messages
        // and apply ignore list
        for (i=0; i<messages.length; i++) {
            messages[i].sid = messages[i].id;
            currentMessageDay = new Date(messages[i].datetime).setHours(0, 0, 0, 0);
            currentMessage = messages[i];
            if (isIgnored(currentMessage, buffer)) {
                messages.splice(i--, 1);
            }
            if (i > 0) {
                interval = (currentMessageDay - lastMessageDay) / 86400000;
                for (j=interval; j>0; j--) {
                    messages.splice(i++, 0, createDayChangeMessage(lastMessage, currentMessageDay - ((j-1)*86400000)));
                }
            }
            lastMessageDay = currentMessageDay;
            lastMessage = currentMessage;
            
        }
        interval = (today - lastMessageDay) / 86400000;
        // Add missing DayChange messages after last message
        for (j=0; j<interval; j++) {
            messages.push(createDayChangeMessage(lastMessage, lastMessageDay + ((j+1)*86400000)));
        }
        return messages;
    }

    $quassel.on('init', function(networkId) {
        $scope.networks = [];
    });

    $quassel.on('network.init', function(networkId) {
        var networks = this.getNetworks();
        var network = networks.get(networkId);
        $scope.networks.push(network);
    });

    $quassel.on('network.addbuffer', function(networkId, bufferId) {
        var network = this.getNetworks().get(networkId);
        network._buffers = network.getBufferHashMap().values();
    });

    $quassel.on('buffer.backlog', function(bufferId, messageIds) {
        if (messageIds.length === 0) {
            // No more backlogs to receive for this buffer
            loadingMoreBacklogs[''+bufferId] = 'stop';
        } else if ($scope.buffer !== null) {
            loadingMoreBacklogs[''+bufferId] = false;
            if (bufferId === $scope.buffer.id) {
                updateMessages();
            }
        }
        if (typeof initialLastSeenList[bufferId] !== 'undefined') {
            // Call lastseen again after backlogs are received the first time
            $quassel.emit('buffer.lastseen', bufferId, initialLastSeenList[bufferId]);
            delete initialLastSeenList[bufferId];
        }
    });

    function setHighlight(buffer, value) {
        if ((value === 0) ||
            (value == 'high' && buffer.highlight != 'high') ||
            (value == 'medium' && buffer.highlight != 'high' && buffer.highlight != 'medium') ||
            (value == 'low' && !buffer.highlight)) {
            $scope.$apply(function(){
                buffer.highlight = value;
            });
            $scope.$emit('highlight');
            return true;
        }
        return false;
    }

    function incFavico(buffer) {
        if (buffer.favico === undefined) buffer.favico = 0;
        buffer.favico++;
        $favico.more();
    }

    $quassel.on('buffer.lastseen', function(bufferId, messageId) {
        messageId = parseInt(messageId, 10);
        var buffer = this.getNetworks().findBuffer(bufferId);
        if (buffer !== null) {
            // Fix networkStatusBuffer sync from server
            if (buffer.isStatusBuffer()) {
                var network = this.getNetworks().get(buffer.network);
                network.setStatusBuffer(buffer);
            }

            var bufferLastMessage = buffer.getLastMessage();
            if (typeof bufferLastMessage === 'undefined' && $config.get('initialBacklogLimit', 20, true) !== 0) {
                initialLastSeenList[bufferId] = messageId;
            }
            if (typeof bufferLastMessage !== 'undefined' && messageId < bufferLastMessage.id) {
                var found = buffer.messages.forEach(function(val, key){
                    if (key > messageId) {
                        if (buffer.isStatusBuffer()) {
                            setHighlight(buffer, 'low');
                            return false;
                        } else if (!buffer.isChannel()) {
                            if (setHighlight(buffer, 'high')) {
                                incFavico(buffer);
                            }
                            return false;
                        } else if (typeof val.isHighlighted === 'function' && val.isHighlighted()) {
                            if (setHighlight(buffer, 'high')) {
                                incFavico(buffer);
                            }
                            $desktop(buffer.name, val.content);
                            return false;
                        }
                    }
                    return true;
                }, undefined, true);
                if (!found) {
                    setHighlight(buffer, 'low');
                }
            }
        }
    });

    $quassel.on('buffer.markerline', function(bufferId, messageId) {
        var buffer = this.getNetworks().findBuffer(bufferId);
        if (buffer !== null) {
            buffer.markerline = parseInt(messageId, 10);
        }
    });

    $quassel.on('buffer.message', function(bufferId, messageId) {
        var buffer = this.getNetworks().findBuffer(bufferId);
        if (buffer !== null) {
            var message = buffer.messages.get(parseInt(messageId, 10));
            if ($scope.buffer !== null && buffer.id === $scope.buffer.id && $wfocus.isFocus()) {
                $quassel.markBufferAsRead(bufferId, messageId);
            } else {
                if (!$wfocus.isFocus() && $scope.buffer !== null && buffer.id === $scope.buffer.id) {
                    $wfocus.onNextFocus(function(){
                        $quassel.markBufferAsRead(bufferId, messageId);
                    });
                }
                if (buffer.isStatusBuffer()) {
                    setHighlight(buffer, 'low');
                } else if (!buffer.isChannel()) {
                    if (!message.isSelf()) {
                        if (setHighlight(buffer, 'high')) {
                            incFavico(buffer);
                        }
                        $desktop(buffer.name, message.content);
                    }
                } else {
                    if (message.isHighlighted()) {
                        if (setHighlight(buffer, 'high')) {
                            incFavico(buffer);
                        }
                        $desktop(buffer.name, message.content);
                    } else if (message.type == MT.Plain || message.type == MT.Action) {
                        setHighlight(buffer, 'medium');
                    } else {
                        setHighlight(buffer, 'low');
                    }
                }
            }
        }
        if ($scope.buffer === null) {
            $scope.messages = [];
        } else if (bufferId === $scope.buffer.id) {
            updateMessages();
        }
    });

    $quassel.on('buffer.read', function(bufferId) {
        var buffer = this.getNetworks().findBuffer(bufferId);
        if (buffer !== null) {
            while(buffer.favico > 0) {
                $favico.less();
                buffer.favico--;
            }
            setHighlight(buffer, 0);
        }
    });

    $quassel.on('buffer.remove', function(bufferId) {
        var networks = this.getNetworks().all();
        $scope.$apply(function(){
            for (var i=0; i<networks.length; i++) {
                networks[i]._buffers = networks[i].getBufferHashMap().values();
            }
        });
    });

    $quassel.on('buffer.merge', function(bufferId1, bufferId2) {
        var buffer1 = this.getNetworks().findBuffer(bufferId1);
        var network = this.getNetworks().get(buffer1.network);
        $scope.$apply(function(){
            network._buffers = network.getBufferHashMap().values();
        });
    });

    $quassel.on('ignorelist', function(list) {
        $ignore.setList(list);
        $ignore.incRevision();
        $scope.$apply(function(){
            updateMessages();
        });
    });

    $quassel.on('buffer.hidden', function() {
        $scope.$apply();
    });

    $quassel.on('buffer.unhide', function() {
        $scope.$apply();
    });

    $scope.showBuffer = function(channel) {
        $scope.buffer = channel;
        updateMessages();
        var id = 0;
        channel.messages.forEach(function(val, key) {
            if (val.id > id) id = val.id;
        });
        $('#messagebox').focus();
        $quassel.markBufferAsRead(channel.id, id);
    };

    $scope.loadMore = function() {
        if ($scope.buffer !== null && (typeof loadingMoreBacklogs[''+$scope.buffer.id] === 'undefined' || loadingMoreBacklogs[''+$scope.buffer.id] === false) && loadingMoreBacklogs[''+$scope.buffer.id] !== 'stop') {
            var firstMessage = Math.min.apply(null, $scope.buffer.messages.keys());
            loadingMoreBacklogs[''+$scope.buffer.id] = true;
            if (firstMessage === Infinity) firstMessage = -1;
            $quassel.moreBacklogs($scope.buffer.id, firstMessage);
            return true;
        }
        return false;
    };

    $scope.connect = function(network) {
        $quassel.requestConnectNetwork(network.networkId);
    };

    $scope.disconnect = function(network) {
       $quassel.requestDisconnectNetwork(network.networkId);
    };

    $scope.openModalJoinChannel = function(network) {
        var modalInstance = $uibModal.open({
            templateUrl: 'modalJoinChannel.html',
            controller: 'ModalJoinChannelInstanceCtrl',
            resolve: {
                network: function(){return network;}
            }
        });

        modalInstance.result.then(function (name) {
            $quassel.sendMessage(network.getStatusBuffer().id, '/join ' + name);
        });
    };

    $scope.channelPart = function(channel) {
        $quassel.sendMessage(channel.id, '/part');
    };

    $scope.channelJoin = function(channel) {
        $quassel.sendMessage(channel.id, '/join ' + channel.name);
    };

    $scope.channelDelete = function(channel) {
        $quassel.requestRemoveBuffer(channel.id);
    };

    $scope.onDropComplete = function(dragged, dropped) {
        if (dragged.isChannel() || dropped.isChannel()) {
            $alert.warn("Merging non-query buffers is not supported");
        } else if (dragged.network !== dropped.network) {
            $alert.warn("Merging buffers from different networks is not supported");
        } else if (dragged.id !== dropped.id) {
            if (window.confirm("Do you want to merge buffer '" + dragged.name + "' into buffer '" + dropped.name + "' ?")) {
                $quassel.requestMergeBuffersPermanently(dropped.id, dragged.id);
            }
        }
    };

    $scope.channelHidePermanently = function(channel) {
        $quassel.requestHideBufferPermanently(channel.id);
    };

    $scope.channelHideTemporarily = function(channel) {
        $quassel.requestHideBufferTemporarily(channel.id);
    };

    $scope.channelUnhide = function(channel) {
        $quassel.requestUnhideBuffer(channel.id);
    };

    $scope.userQuery = function(user) {
        var network = $quassel.get().getNetworks().get($scope.buffer.network);
        var buffer;
        if (network !== null) {
            buffer = network.getBuffer(user.nick);
            if (buffer !== null) {
                $scope.showBuffer(buffer);
            } else {
                $quassel.once('network.addbuffer', function(networkId, bufferId) {
                    network = $quassel.get().getNetworks().get(networkId);
                    buffer = network.getBuffer(bufferId);
                    if (buffer !== null) {
                        $scope.$apply(function(){
                            $scope.showBuffer(buffer);
                        });
                    }
                });
                $quassel.sendMessage($scope.buffer.id, '/query ' + user.nick);
            }
        }
    };
}])
.controller('ModalJoinChannelInstanceCtrl', function ($scope, $modalInstance, network) {
    $scope.name = '';
    $scope.network = network;

    $scope.ok = function () {
        $modalInstance.close($scope.name);
    };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
})
.controller('ConfigController', ['$scope', '$uibModal', '$theme', '$ignore', '$quassel', '$config', function($scope, $uibModal, $theme, $ignore, $quassel, $config) {
    // $scope.activeTheme is assigned in the theme directive
    $scope.getAllThemes = $theme.getAllThemes;
    $scope.ignoreList = $ignore.getList();
    $scope.displayIgnoreList = false;
    var modal, activeIndice = 0, dbg = require("debug");

    $scope.setTheme = function(theme) {
        $scope.activeTheme = theme;
        $theme.setClientTheme(theme);
    };

    $scope.configTheme = function() {
        modal = $uibModal.open({
            templateUrl: 'modalChangeTheme.html',
            scope: $scope,
        });
    };

    $scope.configIgnoreList = function() {
        $scope.ignoreList = $ignore.getList();
        $scope.activeIndice = 0;
        modal = $uibModal.open({
            templateUrl: 'modalIgnoreList.html',
            scope: $scope,
        });
    };

    $scope.gsdisplayfullhostmask = function(newValue) {
        if (arguments.length > 0) {
            $config.set('displayfullhostmask', newValue);
        }
        return $config.get('displayfullhostmask', false);
    };

    $scope.gsdebug = function(newValue) {
        if (arguments.length > 0) {
            if (newValue) {
                dbg.enable("qtdatastream:*,libquassel:*");
            } else {
                dbg.disable();
            }
        }
        return $config.get('debug', false, true) ? true : false;
    };

    $scope.configGeneral = function() {
        modal = $uibModal.open({
            templateUrl: 'modalGeneralConfig.html',
            scope: $scope,
        });
    };

    $scope.cancelIgnoreList = function() {
        $ignore.restoreSavedList();
        modal.dismiss('close');
    };

    $scope.saveIgnoreList = function() {
        $ignore.setList($scope.ignoreList);
        $ignore.save();
        modal.dismiss('close');
    };

    $scope.createIgnoreItem = function() {
        $ignore.createItem();
        $scope.ignoreList = $ignore.getList();
    };

    $scope.setActiveIndice = function(indice) {
        activeIndice = indice;
    };

    $scope.deleteSelectedIgnoreItem = function() {
        $ignore.deleteItem(activeIndice);
        $scope.ignoreList = $ignore.getList();
    };

    $quassel.once('ignorelist', function(list) {
        $scope.$apply(function(){
            $scope.displayIgnoreList = true;
        });
    });
}])
.controller('QuasselController', ['$scope', '$quassel', '$timeout', '$window', '$alert', '$config', '$favico', '$rootScope', function($scope, $quassel, $timeout, $window, $alert, $config, $favico, $rootScope) {
    $scope.disconnected = false;
    $scope.connecting = false;
    $scope.logged = false;
    $scope.remember = $config.get('remember') || false;
    $scope.host = $scope.remember ? $config.get('host') || "" : "";
    $scope.port = $scope.remember ? $config.get('port') || "" : "";
    $scope.user = $config.get('user') || "";
    $scope.password = $config.get('password') || "";
    $scope.securecoreconnection = !$config.get('unsecurecore', false);
    $scope.initialBacklogLimit = parseInt($config.get('initialBacklogLimit', 20, true), 10);
    $scope.backlogLimit = parseInt($config.get('backlogLimit', 100, true), 10);
    $scope.alert = "";

    $rootScope.$on('defaultsettings', function() {
        $scope.securecoreconnection = !$config.get('unsecurecore', !$scope.securecoreconnection);
        $scope.initialBacklogLimit = parseInt($config.get('initialBacklogLimit', $scope.initialBacklogLimit, true), 10);
        $scope.backlogLimit = parseInt($config.get('backlogLimit', $scope.backlogLimit, true), 10);
    });

    $scope.$watch('alert', function(newValue, oldValue) {
        if (newValue !== "") {
            $timeout(function(){
                $scope.alert = "";
            }, 8000);
        }
    });

    $scope.$watch('remember', function(newValue, oldValue) {
        $config.set('remember', newValue);
        if (!newValue) {
            $config.del('host');
            $config.del('port');
        }
    });
    
    $scope.$watch('disconnected', function(newValue, oldValue) {
        if (newValue) {
            $favico.reset();
        }
    });

    /*
    $socket.on('_error', function(e) {
        console.log(e);
        switch (e.errno) {
        case 'ECONNREFUSED':
            $scope.$apply(function(){
                $scope.alert = "Connection refused.";
            });
            break;
        default:
            $alert.error('Error received from server. See Javascript console for details.');
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
    */
    $quassel.on('ws.close', function() {
        console.log('DISCONNECTED');
        $quassel.disconnect();
        $scope.$apply(function(){
            $scope.connecting = false;
            $scope.disconnected = true;
        });
    });

    $quassel.on('loginfailed', function() {
        console.log('loginfailed');
        $scope.$apply(function(){
            $scope.connecting = false;
            $scope.alert = "Invalid username or password.";
        });
    });

    $quassel.on('login', function() {
        console.log('Logged in');
        $scope.$apply(function(){
            $scope.connecting = false;
            $scope.logged = true;
        });
    });

    $quassel.on('coreinfo', function(coreinfo) {
        if (coreinfo.CoreFeatures && coreinfo.CoreFeatures < 4) {
            $alert.error('Your quasselcore is not supported by quassel-webserver (version too old)');
        }
    });

    $quassel.on('disconnect', function() {
        console.log('DISCONNECT');
        $scope.$apply(function(){
            $scope.disconnected = true;
        });
    });

    $quassel.on('reconnect', function() {
        console.log('RECONNECT');
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

    $scope.logout = function(){
        $scope.remember = false;
        $scope.reload();
    };

    $scope.login = function(){
        $scope.connecting = true;
        $quassel.setServer($scope.host, $scope.port, $scope.user, $scope.password);
        $quassel.connect();
        if ($scope.remember) {
            $config.set('user', $scope.user);
            $config.set('password', $scope.password);
            $config.set('host', $scope.host);
            $config.set('port', $scope.port);
        }
        $config.set('unsecurecore', !$scope.securecoreconnection, true);
        $config.set('initialBacklogLimit', $scope.initialBacklogLimit, true);
        $config.set('backlogLimit', $scope.backlogLimit, true);
        console.log('Connecting to quasselcore');
    };

    if ($scope.remember && $scope.user && $scope.password) {
        $scope.login();
    }
}])
.controller('InputController', ['$scope', '$quassel', '$hiddendiv', '$mirc', function($scope, $quassel, $hiddendiv, $mirc) {
    var messagesHistory = [];
    var MT = require('message').Type;

    $scope.inputmessage = '';
    $scope.nick = null;
    $scope.formattervisible = false;

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
                $scope.$apply(function(){
                    $scope.inputmessage = msg;
                });
            }
        }
    };

    $scope.showNextMessage = function(bufferId) {
        if (typeof messagesHistory[''+bufferId] !== 'undefined') {
            var msg = messagesHistory[''+bufferId].next();
            if (msg !== null) {
                $scope.$apply(function(){
                    $scope.inputmessage = msg;
                });
            }
        }
    };

    $scope.sendMessage = function() {
        if ($scope.buffer && typeof $scope.buffer.id === "number" && $scope.inputmessage.length > 0) {
            var hd = $hiddendiv.get();
            hd.html($scope.inputmessage);
            var message = cleanMessage(hd);
            hd.html("");
            if (message) {
                var lines = message.match(/[^\r\n]+/gm);
                if (lines && lines.length > 0) {
                    $scope.clearMessageHistory($scope.buffer.id);
                    for (var idx in lines) {
                        $quassel.sendMessage($scope.buffer.id, lines[idx]);
                    }
                    $scope.addMessageHistory($scope.inputmessage, $scope.buffer.id);
                    $scope.inputmessage = '';
                }
            }
        }
    };

    var modifiersMap = {
        bold: '\x02',
        italic: '\x1D',
        underline: '\x1F',
        color: '\x03',
        all: '\x0F'
    };

    var props = ['bold', 'italic', 'underline'];

    function applyModifiersToString(pendingModifiers, contextModifiers, rootModifiers) {
        var prop, closingColorTag = false, modifiers = [], currentContextModifier = contextModifiers;
        for (prop in props) {
            if (pendingModifiers[props[prop]] !== currentContextModifier[props[prop]]) {
                modifiers.push(modifiersMap[props[prop]]);
                contextModifiers[props[prop]] = pendingModifiers[props[prop]];
            }
        }
        if (pendingModifiers.color[0] !== currentContextModifier.color[0] || pendingModifiers.color[1] !== currentContextModifier.color[1]) {
            // Background or foreground color changed
            var tmpModifier = modifiersMap.color;
            var tmpColorModifier;
            if (pendingModifiers.color[0] === rootModifiers.color[0] && pendingModifiers.color[1] !== rootModifiers.color[1] ||
                pendingModifiers.color[0] !== rootModifiers.color[0] && pendingModifiers.color[1] === rootModifiers.color[1]) {
                tmpModifier += modifiersMap.color; // Close then open a new one
            }
            if (pendingModifiers.color[0] === rootModifiers.color[0] && pendingModifiers.color[1] === rootModifiers.color[1]) {
                closingColorTag = true;
            } else {
                if (pendingModifiers.color[0] !== currentContextModifier.color[0]) {
                    // Foreground color changed
                    tmpColorModifier = $mirc.getMIRCIndByColor(pendingModifiers.color[0]);
                    tmpModifier += tmpColorModifier !== false ? tmpColorModifier : '1';
                    contextModifiers.color[0] = pendingModifiers.color[0];
                } else {
                    if (pendingModifiers.color[1] !== currentContextModifier.color[1]) {
                        // background changed but not foreground, so use parents foreground if possible
                        tmpColorModifier = $mirc.getMIRCIndByColor(currentContextModifier.color[0]);
                        tmpModifier += tmpColorModifier !== false ? tmpColorModifier : '1';
                    } else {
                        tmpModifier += '1';
                        contextModifiers.color[0] = '1';
                    }
                }
                if (pendingModifiers.color[1] !== false && pendingModifiers.color[1] !== currentContextModifier.color[1]) {
                    // Background color changed
                    tmpModifier += ',' + $mirc.getMIRCIndByColor(pendingModifiers.color[1]);
                    contextModifiers.color[1] = pendingModifiers.color[1];
                }
            }
            modifiers.push(tmpModifier);
        }
        if (!contextModifiers.bold && !contextModifiers.italic && !contextModifiers.underline && closingColorTag) return modifiersMap.all;
        return modifiers.join("");
    }

    function cleanMessage(input) {
        // Replace html tags with IRC formatting chars
        var message = '';
        var rootModifiers = {
            bold: false,
            italic: false,
            underline: false,
            color: [
                false,
                false
            ]
        };
        var contextModifiers = $.extend(true, {}, rootModifiers);
        var modifiersByLevel = [$.extend(true, {}, rootModifiers)];
        var level = 1;
        function nodesProcessor() {
            if (this.nodeType === 1) {  // Element Node
                var cs = $(this).css(['font-weight', 'font-style', 'text-decoration', 'color', 'background-color']);
                modifiersByLevel[level] = {
                    bold: $mirc.isBold(cs['font-weight']) || modifiersByLevel[level-1].bold,
                    italic: $mirc.isItalic(cs['font-style']) || modifiersByLevel[level-1].italic,
                    underline: $mirc.isUnderline(cs['text-decoration']) || modifiersByLevel[level-1].underline,
                    color: [
                        $mirc.getMIRCValidColor(cs['color']) || modifiersByLevel[level-1].color[0],
                        $mirc.getMIRCValidColor(cs['background-color']) || modifiersByLevel[level-1].color[1]
                    ]
                };
            } else if (this.nodeType === 3) {  // Text Node
                message += applyModifiersToString(modifiersByLevel[level-1], contextModifiers, rootModifiers);
                message += this.textContent;
            }
            if (this.nodeType === 1) {
                level = level + 1;
                $(this).contents().each(nodesProcessor);
                level = level - 1;
            }
        }
        input.contents().each(nodesProcessor);
        return message;
    }

    $scope.execCommand = function(value) {
        document.execCommand(value, false, null);
    };

    $scope.$watch('buffer', function(newValue, oldValue) {
        var valid = false;
        if (newValue !== null) {
            if (typeof newValue.network === "number") {
                var network = $quassel.get().getNetworks().get(newValue.network);
                if (network) {
                    $scope.nick = network.nick;
                    valid = true;
                }
            }
        }
        if (!valid) $scope.nick = null;
    });

    $quassel.on('network.mynick', function(networkId, newNick) {
        if ($scope.buffer && $scope.buffer.network === parseInt(networkId, 10)) {
            $scope.$apply(function(){
                $scope.nick = newNick;
            });
        }
    });
}])
.controller('FilterController', ['$scope', function($scope) {
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

    function onCurrentFilterUpdate() {
        angular.forEach($scope.currentFilter, function(value, key) {
            $scope.currentFilter2[''+value.type] = value.value;
            if (value.label == 'Join') { // Also handle NetsplitJoin
                $scope.currentFilter2['32768'] = value.value;
            } else if (value.label == 'Quit') { // Also handle NetsplitQuit
                $scope.currentFilter2['65536'] = value.value;
            }
        });
    }

    if (localStorage.filter) {
        $scope.defaultFilter = JSON.parse(localStorage.filter);
    }

    $scope.$watch('buffer', function(newValue, oldValue) {
        if (oldValue !== null) {
            bufferFilters[''+oldValue.id] = angular.copy($scope.currentFilter);
        }
        if ((newValue !== null && oldValue === null) || (newValue !== null && oldValue !== null && newValue.id !== oldValue.id)) {
            if (typeof bufferFilters[''+newValue.id] === 'undefined') {
                bufferFilters[''+newValue.id] = angular.copy($scope.defaultFilter);
            }
            $scope.currentFilter = bufferFilters[''+newValue.id];
            onCurrentFilterUpdate();
        }
    });

    $scope.$watch('currentFilter', onCurrentFilterUpdate, true);

    $scope.setAsDefault = function() {
        $scope.defaultFilter = angular.copy($scope.currentFilter);
        localStorage.filter = JSON.stringify($scope.defaultFilter);
    };

    $scope.useDefault = function() {
        $scope.currentFilter = angular.copy($scope.defaultFilter);
        onCurrentFilterUpdate();
    };
}]);
