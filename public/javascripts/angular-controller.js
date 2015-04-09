angular.module('quassel')
.controller('NetworkController', ['$scope', '$networks', '$socket', '$er', '$reviver', '$modal', '$favico', '$alert', '$desktop', '$wfocus', function($scope, $networks, $socket, $er, $reviver, $modal, $favico, $alert, $desktop, $wfocus) {
    $scope.networks = {};
    $scope.buffer = null;
    $scope.messages = [];
    
    var MT = require('message').Type;
    var MF = require('message').Flag;
    var IRCMessage = require('message').IRCMessage;
    var changesTimeout = [];
    var loadingMoreBacklogs = [];
    
    function createDayChangeMessage(id, timestamp) {
        var message = new IRCMessage({
            id: id,
            timestamp: timestamp/1000,
            type: MT.DayChange,
            flags: MF.ServerMsg
        });
        message.__s_done = true;
        message.sid = id+timestamp;
        return message;
    }
    
    function insertDayChangeMessages(messages) {
        var i, j, lastMessageDay, lastMessageId, currentMessageDay, currentMessageId,
            interval, today = new Date().setHours(0, 0, 0, 0);
        // Sort by id
        messages.sort(function(a, b){
            if (a.id === b.id) return 0;
            else if (a.id > b.id) return 1;
            else return 0;
        });
        // Add missing DayChange messages between existing messages
        for (i=0; i<messages.length; i++) {
            messages[i].sid = messages[i].id;
            currentMessageDay = new Date(messages[i].datetime).setHours(0, 0, 0, 0);
            currentMessageId = messages[i].id;
            if (i > 0) {
                interval = (currentMessageDay - lastMessageDay) / 86400000;
                for (j=interval; j>0; j--) {
                    messages.splice(i++, 0, createDayChangeMessage(lastMessageId, currentMessageDay - ((j-1)*86400000)));
                }
            }
            lastMessageDay = currentMessageDay;
            lastMessageId = currentMessageId;
        }
        interval = (today - lastMessageDay) / 86400000;
        // Add missing DayChange messages after last message
        for (j=0; j<interval; j++) {
            messages.push(createDayChangeMessage(lastMessageId, lastMessageDay + ((j+1)*86400000)));
        }
        return messages;
    }
    
    $er.setCallback(function(event) {
        $socket.emit('register', event);
    });
    
    // Internal
    $er.on('_init', function(next, data) {
        $scope.$apply(function(){
            $networks.set(data);
            $reviver.reviveAll($networks.get());
            $scope.networks = $networks.get().all();
        });
        next();
    });
    
    // Internal
    $er.on('network._init', function(next, networkId, data) {
        $reviver.reviveAll(data);
        $networks.get().set(networkId, data);
        $scope.networks = $networks.get().all();
        next();
    }).after('_init');
    
    $er.on('network.init', function(next, networkId) {
        next();
    }).after('network._init');
    
    $er.on('network.addbuffer', function(next, networkId, bufferId) {
        var network = $networks.get().get(networkId);
        network._buffers = network.getBufferHashMap().values();
        next();
    }).after('network.init');
    
    jsonpatch.reviver = $reviver;
    $er.on('change', function(next, networkId, change) {
        if (!jsonpatch.apply($networks.get().get(networkId), change)) {
            console.log('Patch failed!');
        } else {
            clearTimeout(changesTimeout[networkId]);
            changesTimeout[networkId] = setTimeout(function() {
                $scope.$apply();
            }, 10);
        }
        next();
    }).after('network.init');
    
    $er.on('buffer.backlog', function(next, bufferId, messageIds) {
        if (messageIds.length === 0) {
            // No more backlogs to receive for this buffer
            loadingMoreBacklogs[''+bufferId] = 'stop';
        } else if ($scope.buffer !== null) {
            loadingMoreBacklogs[''+bufferId] = false;
            if (bufferId === $scope.buffer.id) {
                $scope.messages = insertDayChangeMessages($scope.buffer.messages.values());
            }
        }
        next();
    });
    
    $er.on('buffer.lastseen', function(next, bufferId, messageId) {
        messageId = parseInt(messageId, 10);
        var buffer = $networks.get().findBuffer(bufferId);
        if (buffer !== null) {
            var bufferLastMessage = buffer.getLastMessage();
            if (typeof bufferLastMessage !== 'undefined' && messageId < bufferLastMessage.id) {
                var found = buffer.messages.forEach(function(val, key){
                    if (key > messageId && typeof val.isHighlighted === 'function' && val.isHighlighted()) {
                        if (buffer.highlight !== 2) {
                            $scope.$apply(function(){
                                buffer.highlight = 2;
                                $favico.more();
                            });
                        }
                        $desktop(buffer.name, val.content);
                        return false;
                    }
                    return true;
                }, undefined, true);
                if (!found) {
                    $scope.$apply(function(){
                        buffer.highlight = 1;
                    });
                }
            }
        }
        next();
    }).after('buffer.backlog');
    
    $er.on('buffer.markerline', function(next, bufferId, messageId) {
        var buffer = $networks.get().findBuffer(bufferId);
        if (buffer !== null) {
            buffer.markerline = parseInt(messageId, 10);
        }
        next();
    }).after('buffer.backlog');
    
    $er.on('buffer.message', function(next, bufferId, messageId) {
        var buffer = $networks.get().findBuffer(bufferId);
        if (buffer !== null) {
            $reviver.afterReviving(buffer.messages, function(obj){
                var message = obj.get(parseInt(messageId, 10));
                if ($scope.buffer !== null && buffer.id === $scope.buffer.id && $wfocus.isFocus()) {
                    $socket.emit('markBufferAsRead', bufferId, messageId);
                } else {
                    $reviver.afterReviving(message, function(obj2){
                        if (!$wfocus.isFocus() && $scope.buffer !== null && buffer.id === $scope.buffer.id) {
                            $wfocus.onNextFocus(function(){
                                $socket.emit('markBufferAsRead', bufferId, messageId);
                            });
                        }
                        if (obj2.isHighlighted()) {
                            if (buffer.highlight !== 2) {
                                $scope.$apply(function(){
                                    buffer.highlight = 2;
                                    $favico.more();
                                });
                            }
                            $desktop(buffer.name, obj2.content);
                        } else if (obj2.type == MT.Plain || obj2.type == MT.Action) {
                            if (buffer.highlight !== 2 && buffer.highlight !== 1) {
                                $scope.$apply(function(){
                                    buffer.highlight = 1;
                                });
                            }
                        }
                    });
                }
            });
        }
        if ($scope.buffer === null) {
            $scope.messages = [];
        } else if (bufferId === $scope.buffer.id) {
            $scope.messages = insertDayChangeMessages($scope.buffer.messages.values());
        }
        next();
    }).after('network.addbuffer');
    
    $er.on('buffer.read', function(next, bufferId) {
        var buffer = $networks.get().findBuffer(bufferId);
        if (buffer !== null) {
            if (buffer.highlight === 2) {
                $favico.less();
            }
            $scope.$apply(function(){
                buffer.highlight = 0;
            });
        }
        next();
    }).after('network.addbuffer');
    
    $er.on('buffer.remove', function(next, bufferId) {
        var networks = $networks.get().all();
        $scope.$apply(function(){
            for (var i=0; i<networks.length; i++) {
                networks[i]._buffers = networks[i].getBufferHashMap().values();
            }
        });
        next();
    });
    
    $er.on('buffer.merge', function(next, bufferId1, bufferId2) {
        var buffer1 = $networks.get().findBuffer(bufferId1);
        var network = $networks.get().get(buffer1.network);
        $scope.$apply(function(){
            network._buffers = network.getBufferHashMap().values();
        });
        next();
    });
    
    $scope.showBuffer = function(channel) {
        $scope.buffer = channel;
        $scope.messages = insertDayChangeMessages(channel.messages.values());
        var id = 0;
        channel.messages.forEach(function(val, key) {
            if (val.id > id) id = val.id;
        });
        
        $socket.emit('markBufferAsRead', channel.id, id);
    };
    
    $scope.loadMore = function() {
        if ($scope.buffer !== null && (typeof loadingMoreBacklogs[''+$scope.buffer.id] === 'undefined' || loadingMoreBacklogs[''+$scope.buffer.id] === false) && loadingMoreBacklogs[''+$scope.buffer.id] !== 'stop') {
            var firstMessage = Math.min.apply(null, $scope.buffer.messages.keys());
            loadingMoreBacklogs[''+$scope.buffer.id] = true;
            if (firstMessage === Infinity) firstMessage = -1;
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
            controller: 'ModalJoinChannelInstanceCtrl',
            resolve: {
                network: function(){return network;}
            }
        });
    
        modalInstance.result.then(function (name) {
            $socket.emit('sendMessage', network.getStatusBuffer().id, '/join ' + name);
        });
    };
    
    $scope.channelPart = function(channel) {
        $socket.emit('sendMessage', channel.id, '/part');
    };
    
    $scope.channelJoin = function(channel) {
        $socket.emit('sendMessage', channel.id, '/join ' + channel.name);
    };
    
    $scope.channelDelete = function(channel) {
        $socket.emit('requestRemoveBuffer', channel.id);
    };
    
    $scope.onDropComplete = function(dragged, dropped) {
        if (dragged.isChannel() || dropped.isChannel()) {
            $alert.warn("Merging non-query buffers is not supported");
        } else if (dragged.network !== dropped.network) {
            $alert.warn("Merging buffers from different networks is not supported");
        } else if (dragged.id !== dropped.id) {
            if (window.confirm("Do you want to merge buffer '" + dragged.name + "' into buffer '" + dropped.name + "' ?")) {
                $socket.emit('requestMergeBuffersPermanently', dropped.id, dragged.id);
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
.controller('ConfigController', ['$scope', '$modal', '$theme', function($scope, $modal, $theme) {
    // $scope.activeTheme is assigned in the theme directive
    $scope.getAllThemes = $theme.getAllThemes;
    $scope.setTheme = function(theme) {
        $scope.activeTheme = theme;
        $theme.setClientTheme(theme);
    }

    $scope.configTheme = function() {
        $modal.open({
            templateUrl: 'modalChangeTheme.html',
            scope: $scope,
        });
    };   
    
}])
.controller('SocketController', ['$scope', '$socket', '$er', '$timeout', '$window', '$alert', function($scope, $socket, $er, $timeout, $window, $alert) {
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
}])
.controller('InputController', ['$scope', '$socket', function($scope, $socket) {
    var messagesHistory = [];
    var MT = require('message').Type;
    
    $scope.inputmessage = '';
    
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
            $socket.emit('sendMessage', $scope.buffer.id, $scope.inputmessage);
            $scope.addMessageHistory($scope.inputmessage, $scope.buffer.id);
            $scope.inputmessage = '';
        }
    };
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