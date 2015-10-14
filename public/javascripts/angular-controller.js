angular.module('quassel')
.controller('NetworkController',
        ['$scope', '$quassel', '$modal', '$favico', '$alert', '$desktop', '$wfocus', '$ignore',
            function($scope, $quassel, $modal, $favico, $alert, $desktop, $wfocus, $ignore) {
    $scope.networks = [];
    $scope.buffer = null;
    $scope.messages = [];
    
    var MT = require('message').Type;
    var MF = require('message').Flag;
    var IRCMessage = require('message').IRCMessage;
    var loadingMoreBacklogs = [];
    
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
            messages = applyIgnoreList(messages, $scope.buffer);
            $scope.messages = insertDayChangeMessages(messages);
        }
    }
    
    function applyIgnoreList(messages, buffer) {
        var i = 0, shouldDelete = false;
        for (; i<messages.length; i++) {
            shouldDelete = false;
            if (buffer.ignoreListRevision === $ignore.getRevision() && typeof messages[i].isIgnored === "boolean") {
                shouldDelete = messages[i].isIgnored;
            } else if ($ignore.getList().matches(messages[i], $quassel.get().getNetworks())) {
                messages[i].isIgnored = true;
                shouldDelete = true;
            } else {
                messages[i].isIgnored = false;
            }
            if (shouldDelete) {
                messages.splice(i, 1);
                i--;
            }
        }
        buffer.ignoreListRevision = $ignore.getRevision();
        return messages;
    }
    
    function insertDayChangeMessages(messages) {
        var i, j, lastMessageDay, lastMessage, currentMessageDay, currentMessage,
            interval, today = new Date().setHours(0, 0, 0, 0);
        // Sort by id
        messages.sort(function(a, b){
            return a.id - b.id;
        });
        // Add missing DayChange messages between existing messages
        for (i=0; i<messages.length; i++) {
            messages[i].sid = messages[i].id;
            currentMessageDay = new Date(messages[i].datetime).setHours(0, 0, 0, 0);
            currentMessage = messages[i];
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
                    if (setHighlight(buffer, 'high')) {
                        incFavico(buffer);
                    }
                    $desktop(buffer.name, message.content);
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
        var modalInstance = $modal.open({
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
.controller('ConfigController', ['$scope', '$modal', '$theme', '$ignore', '$quassel', '$config', function($scope, $modal, $theme, $ignore, $quassel, $config) {
    // $scope.activeTheme is assigned in the theme directive
    $scope.getAllThemes = $theme.getAllThemes;
    $scope.ignoreList = $ignore.getList();
    $scope.displayIgnoreList = false;
    var modal, activeIndice = 0;
    
    $scope.setTheme = function(theme) {
        $scope.activeTheme = theme;
        $theme.setClientTheme(theme);
    };

    $scope.configTheme = function() {
        modal = $modal.open({
            templateUrl: 'modalChangeTheme.html',
            scope: $scope,
        });
    };
    
    $scope.configIgnoreList = function() {
        $scope.ignoreList = $ignore.getList();
        $scope.activeIndice = 0;
        modal = $modal.open({
            templateUrl: 'modalIgnoreList.html',
            scope: $scope,
        });
    };
    
    $scope.gsdisplayfullhostmask = function(newValue) {
        if (arguments.length > 0) {
            $config.set('displayfullhostmask', newValue);
        }
        return $config.get('displayfullhostmask');
    };
    
    $scope.configGeneral = function() {
        modal = $modal.open({
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
.controller('QuasselController', ['$scope', '$quassel', '$timeout', '$window', '$alert', function($scope, $quassel, $timeout, $window, $alert) {
    $scope.disconnected = false;
    $scope.connecting = false;
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
            $scope.alert = "Invalid username or password.";
        });
    });
    
    $quassel.on('login', function() {
        console.log('Logged in');
        $scope.$apply(function(){
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
    
    $scope.login = function(){
        $quassel.setServer($scope.host, $scope.port, $scope.user, $scope.password);
        $quassel.connect();
        console.log('Connecting to quasselcore');
    };
}])
.controller('InputController', ['$scope', '$quassel', function($scope, $quassel) {
    var messagesHistory = [];
    var MT = require('message').Type;
    
    $scope.inputmessage = '';
    $scope.nick = null;
    
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
        if (typeof $scope.buffer.id === "number" && $scope.inputmessage.length > 0) {
            $scope.clearMessageHistory($scope.buffer.id);
            $quassel.sendMessage($scope.buffer.id, $scope.inputmessage);
            $scope.addMessageHistory($scope.inputmessage, $scope.buffer.id);
            $scope.inputmessage = '';
        }
    };
    
    $scope.$watch('buffer', function(newValue, oldValue) {
        var valid = false;
        if (newValue !== null) {
            if (typeof newValue.network === "number") {
                var network = this.get(newValue.network);
                if (network) {
                    $scope.nick = network.nick;
                    valid = true;
                }
            }
        }
        if (!valid) $scope.nick = null;
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
