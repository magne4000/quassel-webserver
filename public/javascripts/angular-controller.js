/* global libquassel */
/* global KeyboardEvent */
/* global angular */
/* global $ */

angular.module('quassel')
.controller('NetworkController',
        ['$scope', '$quassel', '$uibModal', '$favico', '$alert', '$desktop', '$wfocus', '$ignore', '$config', '$responsive', '$highlight',
            function($scope, $quassel, $uibModal, $favico, $alert, $desktop, $wfocus, $ignore, $config, $responsive, $highlight) {
    $scope.networks = [];
    $scope.buffer = null;
    $scope.messages = [];
    $scope.showhidden = false;
    $scope.networkscount = null;
    $scope.shown = true;
    $scope.shown2 = $responsive.getBreakpoint() !== 'xs';

    var MT = libquassel.message.Types;
    var MF = libquassel.message.Flags;
    var IRCMessage = libquassel.message.IRCMessage;
    var loadingMoreBacklogs = new Map;
    var initialLastSeenList = [];
    
    function _updateBuffers(network) {
        var it = network.buffers.values();
        var networkItem = it.next();
        network._buffers = [];
        while(!networkItem.done) {
            if (!networkItem.value.isStatusBuffer) {
                network._buffers.push(networkItem.value);
            }
            networkItem = it.next();
        }
    }

    function createDayChangeMessage(msg, timestamp) {
        var message = new IRCMessage({
            id: msg.id,
            timestamp: timestamp/1000,
            type: MT.DAYCHANGE,
            flags: MF.SERVERMSG,
            bufferInfo: {
                network: msg.networkId,
                id: msg.bufferId
            }
        });
        message.sid = msg.id+timestamp;
        return message;
    }

    function updateMessages() {
        if ($scope.buffer) {
            var messages = [];
            if ($scope.buffer.messages.__mapValuesData__) {
                messages = Array.from($scope.buffer.messages.__mapValuesData__);
            } else {
                messages = Array.from($scope.buffer.messages.values());
            }
            $scope.messages = insertDayChangeMessagesAndApplyIgnoreList(messages, $scope.buffer);
            $scope.buffer.ignoreListRevision = $ignore.getRevision();
        }
    }

    function isIgnored(message, buffer) {
        var shouldDelete = false;
        if (buffer.ignoreListRevision === $ignore.getRevision() && typeof message.isIgnored === "boolean") {
            shouldDelete = message.isIgnored;
        } else if ($ignore.getList().matches(message, $quassel.get().networks)) {
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

    $quassel.on('init', function(obj) {
        $scope.networkscount = obj.SessionState.NetworkIds.length;
        $scope.networks = [];
    });

    $quassel.on('network.init', function(networkId) {
        var network = this.networks.get(networkId);
        $scope.$applyAsync(function(){
            network.collapsed = !network.isConnected;
            $scope.networks.push(network);
            $scope.networkscount = $scope.networks.length;
        });
    });
    
    $quassel.on('network.remove', function(networkId) {
        var index = null;
        for (var i=0; i<$scope.networks.length; i++) {
            if ($scope.networks[i].networkId === networkId) {
                index = i;
                break;
            }
        }
        if (index !== null) {
            $scope.$apply(function(){
                $scope.networks.splice(index, 1);
            });
        }
    });

    $quassel.on('network.addbuffer', function(networkId, bufferId) {
        var network = this.networks.get(networkId);
        _updateBuffers(network);
    });
    
    $quassel.on('network.disconnected', function(networkId) {
        var network = this.networks.get(networkId);
        $scope.$apply(function(){
            network.collapsed = true;
        });
    });
    
    $quassel.on('network.connected', function(networkId) {
        var network = this.networks.get(networkId);
        $scope.$apply(function(){
            network.collapsed = false;
        });
    });

    $quassel.on('buffer.backlog', function(bufferId, messageIds) {
        if (messageIds.length === 0) {
            // No more backlogs to receive for this buffer
            loadingMoreBacklogs.set(bufferId, 'stop');
        } else if ($scope.buffer !== null) {
            loadingMoreBacklogs.set(bufferId, false);
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
        var buffer = this.networks.getBuffer(bufferId);
        if (buffer) {
            // Fix networkStatusBuffer sync from server
            if (buffer.isStatusBuffer) {
                var network = this.networks.get(buffer.network);
                network.statusBuffer = buffer;
            }

            var bufferLastMessage = buffer.lastMessage;
            if (typeof bufferLastMessage === 'undefined' && $config.get('initialBacklogLimit', 20) !== 0) {
                initialLastSeenList[bufferId] = messageId;
            }
            if (typeof bufferLastMessage !== 'undefined' && messageId < bufferLastMessage.id) {
                var somethingfound = false;
                var it = buffer.messages.entries();
                var entry = it.next();
                while (!entry.done) {
                    var message = entry.value[1], key = entry.value[0], highlightmode = null;
                    if (key > messageId && message) {
                        highlightmode = updateBufferHighlightOnMessage(buffer, message);
                        if (highlightmode !== null) {
                            somethingfound = true;
                            if (highlightmode === 'high') break;
                        }
                    }
                    entry = it.next();
                }
                if (!somethingfound) {
                    setHighlight(buffer, 'low');
                }
            }
        }
    });

    $quassel.on('buffer.markerline', function(bufferId, messageId) {
        var buffer = this.networks.getBuffer(bufferId);
        if (buffer) {
            $scope.$apply(function(){
                buffer.markerline = parseInt(messageId, 10);
            });
        }
    });
    
    $quassel.on('buffer.activity', function(bufferId, activity) {
        var buffer = this.networks.getBuffer(bufferId);
        if (buffer) {
            if ((activity & MT.PLAIN) || (activity & MT.NOTICE) || (activity & MT.ACTION)) {
                setHighlight(buffer, 'low');
            }
        }
    });
    
    function updateBufferHighlightOnMessage(buffer, message) {
        var highlightmode = null;
        if (buffer.isStatusBuffer) {
            setHighlight(buffer, 'low');
            highlightmode = 'low';
        } else if (!buffer.isChannel) {
            if (!message.isSelf) {
                if (setHighlight(buffer, 'high')) {
                    incFavico(buffer);
                }
                highlightmode = 'high';
            }
        } else if (!message.isSelf) {
            if (message.isHighlighted) {
                if (setHighlight(buffer, 'high')) {
                    incFavico(buffer);
                }
                highlightmode = 'high';
            } else if (message.type == MT.PLAIN || message.type == MT.ACTION) {
                setHighlight(buffer, 'medium');
                highlightmode = 'medium';
            } else {
                setHighlight(buffer, 'low');
                highlightmode = 'low';
            }
        }
        return highlightmode;
    }

    $quassel.on('buffer.message', function(bufferId, messageId) {
        var buffer = this.networks.getBuffer(bufferId);
        if (buffer) {
            var message = buffer.messages.get(parseInt(messageId, 10));
            if ($scope.buffer !== null && buffer.id === $scope.buffer.id && $wfocus.isFocus()) {
                $quassel.core().markBufferAsRead(bufferId, messageId);
            } else {
                if (!$wfocus.isFocus() && $scope.buffer !== null && buffer.id === $scope.buffer.id) {
                    $wfocus.onNextFocus(function(){
                        $quassel.core().markBufferAsRead(bufferId, messageId);
                    });
                }
                if (updateBufferHighlightOnMessage(buffer, message) === 'high') {
                    $desktop(buffer.name, message.content);
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
        var buffer = this.networks.getBuffer(bufferId);
        if (buffer) {
            while(buffer.favico > 0) {
                $favico.less();
                buffer.favico--;
            }
            setHighlight(buffer, 0);
        }
    });

    $quassel.on('buffer.remove', function(bufferId) {
        var networks = this.networks;
        $scope.$apply(function(){
            networks.forEach(function(network){
                _updateBuffers(network);
            });
        });
    });

    $quassel.on('buffer.merge', function(bufferId1, bufferId2) {
        var buffer1 = this.networks.getBuffer(bufferId1);
        var network = this.networks.get(buffer1.network);
        $scope.$apply(function(){
            network._buffers = network.networks.values();
            _updateBuffers(network);
        });
    });

    $quassel.on('ignorelist', function(list) {
        $ignore.setList(list);
        $ignore.incRevision();
        $scope.$apply(function(){
            updateMessages();
        });
    });
    
    $quassel.on('highlightrules', function(manager) {
        $highlight.setManager(manager);
        $highlight.incRevision();
    });
    
    $quassel.on('buffer.rename', function() {
        $scope.$apply();
    });
    
    $scope.showBuffer = function(channel) {
        if (channel && $scope.buffer === channel) return;
        var olfbuf = $scope.buffer;
        $scope.buffer = channel;
        if ($scope.buffer !== null) {
            updateMessages();
            if ($responsive.getBreakpoint() !== 'xs') {
                $('#messagebox').focus();
            }
            $quassel.core().markBufferAsRead(channel.id, channel._lastMessageId);
            
            // Empty backlogs if configured so
            if ($config.get('emptybufferonswitch', false)) {
                loadingMoreBacklogs.delete(olfbuf.id);
                olfbuf.trimMessages($config.get('emptybufferonswitchvalue', 0));
            }
            
            // Update title
            var network = $quassel.get().networks.get(channel.network);
            document.title = channel.name + ' (' + network.networkName + ') – Quassel Web App';
        } else {
            document.title = 'Quassel Web App';
        }
    };

    $scope.loadMore = function() {
        if ($scope.buffer !== null
            && (!loadingMoreBacklogs.has($scope.buffer.id)
                ||  loadingMoreBacklogs.get($scope.buffer.id) === false)
            && loadingMoreBacklogs.get($scope.buffer.id) !== 'stop') {
            var firstMessageId = $scope.buffer.firstMessageId;
            loadingMoreBacklogs.set($scope.buffer.id, true);
            if (!firstMessageId) firstMessageId = -1;
            $quassel.moreBacklogs($scope.buffer.id, firstMessageId);
            return true;
        }
        return false;
    };

    $scope.connect = function(network) {
        $quassel.core().connectNetwork(network.networkId);
    };

    $scope.disconnect = function(network) {
       $quassel.core().disconnectNetwork(network.networkId);
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
            $quassel.core().sendMessage(network.statusBuffer.getBufferInfo(), '/join ' + name);
        });
    };

    $scope.channelPart = function(channel) {
        $quassel.core().sendMessage(channel.getBufferInfo(), '/part');
    };

    $scope.channelJoin = function(channel) {
        $quassel.core().sendMessage(channel.getBufferInfo(), '/join ' + channel.name);
    };

    $scope.channelDelete = function(channel) {
        $quassel.core().removeBuffer(channel.id);
    };

    $scope.onDropComplete = function(dragged, dropped) {
        if (dragged === dropped) return;
        if (dragged.isChannel() || dropped.isChannel()) {
            $alert.warn("Merging non-query buffers is not supported");
        } else if (dragged.network !== dropped.network) {
            $alert.warn("Merging buffers from different networks is not supported");
        } else if (dragged.id !== dropped.id) {
            if (window.confirm("Do you want to merge buffer '" + dragged.name + "' into buffer '" + dropped.name + "' ?")) {
                $quassel.core().mergeBuffersPermanently(dropped.id, dragged.id);
            }
        }
    };

    $scope.channelHidePermanently = function(channel) {
        $quassel.core().hideBufferPermanently($scope.bufferView.id, channel.id);
    };

    $scope.channelHideTemporarily = function(channel) {
        $quassel.core().hideBufferTemporarily($scope.bufferView.id, channel.id);
    };

    $scope.channelUnhide = function(channel) {
        $quassel.core().unhideBuffer($scope.bufferView.id, channel.id);
    };
    
    $scope.cycleHiddenState = function(channel) {
        if ($scope.bufferView.isPermanentlyRemoved(channel.id)) {
            $scope.channelUnhide(channel);
        } else if ($scope.bufferView.isTemporarilyRemoved(channel.id)) {
            $scope.channelHidePermanently(channel);
        } else {
            $scope.channelHideTemporarily(channel);
        }
    };
    
    $scope.openModalRenameBuffer = function(buffer) {
        var modalInstance = $uibModal.open({
            templateUrl: 'modalRenameBuffer.html',
            controller: 'ModalRenameBufferInstanceCtrl',
            resolve: {
                name: function(){return buffer.name;}
            }
        });

        modalInstance.result.then(function (name) {
            if (name) {
                $quassel.core().renameBuffer(buffer.id, name);
            }
        });
    };

    $scope.userQuery = function(user) {
        var network = $quassel.get().networks.get($scope.buffer.network);
        var buffer;
        if (network !== null) {
            buffer = network.getBuffer(user.nick);
            if (buffer) {
                $scope.showBuffer(buffer);
            } else {
                $quassel.once('network.addbuffer', function(networkId, bufferId) {
                    network = $quassel.get().networks.get(networkId);
                    buffer = network.getBuffer(bufferId);
                    if (buffer) {
                        $scope.$apply(function(){
                            $scope.showBuffer(buffer);
                        });
                    }
                });
                $quassel.core().sendMessage($scope.buffer.getBufferInfo(), '/query ' + user.nick);
            }
        }
    };
    
    $scope.userClass = function(buffer, nick) {
        var uclass = '';
        if (buffer.hasUser(nick)) {
            var bufferUser = buffer.users.get(nick);
            if (bufferUser.isOwner) uclass = 'user-owner';
            else if (bufferUser.isAdmin) uclass = 'user-admin';
            else if (bufferUser.isOp) uclass = 'user-op';
            else if (bufferUser.isHalfOp) uclass = 'user-half-op';
            else if (bufferUser.isVoiced) uclass = 'user-voiced';
        }
        return uclass;
    };
    
    $scope.whois = function(user) {
        if ($scope.buffer !== null) {
            $quassel.core().sendMessage($scope.buffer.getBufferInfo(), '/whois ' + user.nick);
        }
    };
    
    $scope.toggleShowHide = function() {
        $scope.showhidden = !$scope.showhidden;
    };
}])
.controller('ModalJoinChannelInstanceCtrl', function ($scope, $uibModalInstance, network) {
    $scope.name = '';
    $scope.network = network;

    $scope.ok = function () {
        $uibModalInstance.close($scope.name);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
})
.controller('ModalRenameBufferInstanceCtrl', function ($scope, $uibModalInstance, name) {
    $scope.name = name;

    $scope.ok = function () {
        $uibModalInstance.close($scope.name);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
})
.controller('ModalAliasesInstanceCtrl', function ($scope, $uibModalInstance, aliases) {
    var alias = libquassel.alias;
    $scope.aliases = aliases;

    $scope.ok = function () {
        $uibModalInstance.close($scope.aliases);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
    
    $scope.add = function() {
        $scope.aliases.push(new alias.AliasItem("", ""));
    };
    
    $scope.remove = function(ind) {
        $scope.aliases.splice(ind, 1);
    };
    
    $scope.isAliasUnique = function(aliases, name, index) {
        var i = 0;
        for (i; i<aliases.length; i++) {
            if (i === index) continue;
            if (aliases[i].name === name) {
                return false;
            }
        }
        return true;
    };
})
.controller('ModalIdentitiesInstanceCtrl', function ($scope, $uibModalInstance, identities) {
    $scope.identities = identities;
    $scope.activeCategoryIndex = 0;
    $scope.activeIdentityIndex = 0;
    
    $scope.selectIdentity = function(index) {
        $scope.activeIdentityIndex = index;
    };
    
    $scope.selectCategory = function(index) {
        $scope.activeCategoryIndex = index;
    };
    
    $scope.createNick = function() {
        $scope.identities[$scope.activeIdentityIndex].nicks.push('');
    };
    
    $scope.deleteNick = function(nick) {
        $scope.identities[$scope.activeIdentityIndex].nicks.splice($scope.identities[$scope.activeIdentityIndex].nicks.indexOf(nick), 1);
    };
    
    $scope.moveNick = function(indexFrom, indexTo) {
        var tmp = $scope.identities[$scope.activeIdentityIndex].nicks[indexTo];
        $scope.identities[$scope.activeIdentityIndex].nicks[indexTo] = $scope.identities[$scope.activeIdentityIndex].nicks[indexFrom];
        $scope.identities[$scope.activeIdentityIndex].nicks[indexFrom] = tmp;
    };
    
    $scope.createIdentity = function() {
        var identity = {
            autoAwayEnabled: true,
            autoAwayReason: "Not here. No, really. not here!",
            autoAwayReasonEnabled: false,
            autoAwayTime: 10,
            awayNick: "",
            awayNickEnabled: false,
            awayReason: "Gone fishing.",
            awayReasonEnabled: true,
            detachAwayEnabled: false,
            detachAwayReason: "All Quassel clients vanished from the face of the earth...",
            detachAwayReasonEnabled: true,
            ident: "quassel",
            identityName: "New identity",
            kickReason: "Kindergarten is elsewhere!",
            nicks: ["qws-user-" + (Math.floor(Math.random() * 9999))],
            partReason: "http://quassel-irc.org - Chat comfortably. Anywhere.",
            quitReason: "http://quassel-irc.org - Chat comfortably. Anywhere.",
            realName: ""
        };
        $scope.identities.push(identity);
    };
    
    $scope.deleteActiveIdentity = function() {
        $scope.identities.splice($scope.activeIdentityIndex, 1);
    };
    
    $scope.saveIdentities = function() {
        $uibModalInstance.close($scope.identities);
    };
    
    // At initialization, if we have no identity, just add one so the user doesn't have an empty modal
    if ($scope.identities.length === 0) {
        $scope.createIdentity();
    }
})
.controller('ModalNetworkInstanceCtrl', function ($scope, $uibModalInstance, $quassel, networks, identities) {
    $scope.networks = networks;
    $scope.identities = identities;
    $scope.activeNetworkIndex = 0;
    $scope.activeServerIndex = 0;
    $scope.activeServer = null;
    
    $scope.useSSLStateChanged = function (activeServer) {
        if (activeServer.UseSSL) {
            if (activeServer.Port == 6667) activeServer.Port = 6697;
        } else {
            if (activeServer.Port == 6697) activeServer.Port = 6667;
        }
    };

    $scope.saveNetworks = function () {
        $uibModalInstance.close($scope.networks);
    };
    
    $scope.selectServer = function(network, index) {
        $scope.activeServerIndex = index;
        $scope.activeServer = network.ServerList[index];
    };
    
    $scope.addServer = function(network) {
        network.ServerList.push({
            Host: '',
            Port: 6667,
            Password: '',
            UseSSL: false,
            sslVersion: 0,
            UseProxy: false,
            ProxyType: '',
            ProxyHost: '',
            ProxyPort: '',
            ProxyUser: '',
            ProxyPass: '',
            sslVerify: 1
        });
        return true;
    };
    
    $scope.createNetwork = function() {
        $scope.networks.push({
            networkName: 'New network',
            identityId: $scope.identities[0].identityId,
            ServerList: [],
            codecForServer: '',
            codecForEncoding: '',
            codecForDecoding: '',
            useRandomServer: false,
            perform: [],
            useAutoIdentify: false,
            autoIdentifyService: 'NickServ',
            autoIdentifyPassword: '',
            useSasl: false,
            saslAccount: '',
            saslPassword: '',
            useAutoReconnect: true,
            autoReconnectInterval: 60,
            autoReconnectRetries: 20,
            unlimitedReconnectRetries: false,
            rejoinChannels: true,
            useCustomMessageRate: false,
            unlimitedMessageRate: false,
            msgRateMessageDelay: 2200,
            msgRateBurstSize: 5
        });
        $scope.addServer($scope.networks[$scope.networks.length - 1]);
        setTimeout(function() {
            $scope.$apply(function() {
                $scope.activeNetworkIndex = $scope.networks.length - 1;
            });
        }, 10);
        return true;
    };
    
    $scope.deleteActiveNetwork = function() {
        $scope.networks.splice($scope.activeNetworkIndex, 1);
    };
    
    $scope.deleteServer = function(network, index) {
        network.ServerList.splice(index, 1);
        $scope.selectServer(network, 0);
    };
    
    $scope.supportSslVerify = $quassel.supports($quassel.Features.VERIFYSERVERSSL);
    $scope.supportCustomRateLimits = $quassel.supports($quassel.Features.CUSTOMRATELIMITS);
    
    // At initialization, if we have no network, just add one so the user doesn't have an empty modal
    if ($scope.networks.length === 0) {
        $scope.createNetwork();
    }
})
.controller('modalSetupWizardInstanceCtrl', function ($scope, $uibModalInstance, data) {
    $scope.step = 0;
    $scope.username = '';
    $scope.password = '';
    $scope.repeatpassword = '';
    $scope.backends = data;
    $scope.selectedBackend = null;
    $scope.properties = {};
    
    $scope.moveStep = function(moveto) {
        $scope.step = moveto;
    };
    
    $scope.commit = function() {
        var properties = {}, key;
        for (var i=0; i<$scope.selectedBackend.SetupKeys.length; i++) {
            key = $scope.selectedBackend.SetupKeys[i];
            properties[key] = $scope.selectedBackend.SetupDefaults[key] || '';
            if ($scope.properties[key]) {
                properties[key] = $scope.properties[key];
            }
        }
        $uibModalInstance.close([$scope.selectedBackend.DisplayName, properties, $scope.username, $scope.password]);
    };
})
.controller('ConfigController', ['$scope', '$uibModal', '$theme', '$ignore', '$quassel', '$config', '$alert', '$highlight', function($scope, $uibModal, $theme, $ignore, $quassel, $config, $alert, $highlight) {
    // $scope.activeTheme is assigned in the theme directive
    $scope.getAllThemes = $theme.getAllThemes;
    $scope.ignoreList = $ignore.getList();
    $scope.displayIgnoreListConfigItem = false;
    $scope.displayIdentitiesConfigItem = false;
    $scope.displayHighlightConfigItem = false;
    $scope.activeIndice = 0;
    var modal, dbg = libquassel.debug, alias = libquassel.alias;

    $scope.setTheme = function(theme) {
        $scope.activeTheme = theme;
        $theme.setClientTheme(theme);
    };
    
    $scope.configIdentities = function() {
        var modalInstance = $uibModal.open({
            templateUrl: 'modalIdentities.html',
            controller: 'ModalIdentitiesInstanceCtrl',
            scope: $scope.$new(true),
            size: 'lg',
            resolve: {
                identities: function(){
                    var identities = $quassel.get().identities;
                    if (identities.__mapValuesData__) {
                        return angular.copy(identities.__mapValuesData__);
                    }
                    return angular.copy(Array.from(identities.values()));
                }
            }
        });
        
        modalInstance.result.then(function (identities) {
            var im = new Map($quassel.get().identities), i=0, identity, areEquals = false, acount = [0, 0, 0];
            for (;i<identities.length; i++) {
                if (typeof identities[i].identityId === 'number' && identities[i].identityId > -1) {
                    identity = im.get(identities[i].identityId);
                    im.delete(identities[i].identityId);
                    areEquals = angular.equals(identity, identities[i]);
                    if (!areEquals) {
                        // Update identity information
                        $quassel.core().updateIdentity(identity.identityId, identities[i]);
                        acount[1] = acount[1] + 1;
                    }
                } else {
                    // Create the new identity
                    $quassel.core().createIdentity(identities[i].identityName, identities[i]);
                    acount[0] = acount[0] + 1;
                }
            }
            im.forEach(function(identity) {
                $quassel.core().removeIdentity(identity.identityId);
                acount[2] = acount[2] + 1;
            });
        });
    };
    
    $scope.configNetworks = function() {
        if ($quassel.get().identities.size === 0) {
            $quassel.once('identity.new', function() {
                $scope.configNetworks();
            });
            $scope.configIdentities(function(nbcreate){
                if (nbcreate === 0) {
                    $quassel.removeListener('identity.new');
                }
            });
            return;
        }
        
        var modalInstance = $uibModal.open({
            templateUrl: 'modalNetworks.html',
            controller: 'ModalNetworkInstanceCtrl',
            scope: $scope.$new(true),
            size: 'lg',
            resolve: {
                $quassel: function() {
                    return $quassel;
                },
                networks: function(){
                    var networks = $quassel.get().networks;
                    if (networks.__mapValuesData__) {
                        return angular.copy(networks.__mapValuesData__);
                    }
                    return angular.copy(Array.from(networks.values()));
                },
                identities: function(){
                    var identities = $quassel.get().identities;
                    if (identities.__mapValuesData__) {
                        return angular.copy(identities.__mapValuesData__);
                    }
                    return angular.copy(Array.from(identities.values()));
                }
            }
        });

        modalInstance.result.then(function (networks) {
            var nm = new Map($quassel.get().networks), i=0, network, areEquals = false;
            for (;i<networks.length; i++) {
                if (typeof networks[i].networkId === 'number' && networks[i].networkId > -1) {
                    network = nm.get(networks[i].networkId);
                    nm.delete(networks[i].networkId);
                    areEquals = angular.equals(network, networks[i]);
                    if (!areEquals) {
                        // Update network information
                        $quassel.core().setNetworkInfo(network.networkId, networks[i]);
                    }
                } else {
                    // Create the new network
                    $quassel.core().createNetwork(networks[i].networkName, networks[i].identityId, undefined, networks[i]);
                    // TODO Check networkName duplicates
                }
            }
            nm.forEach(function(network) {
                $quassel.core().removeNetwork(network.networkId);
            });
        });
    };
    
    $scope.configAliases = function() {
        var modalInstance = $uibModal.open({
            templateUrl: 'modalAliases.html',
            controller: 'ModalAliasesInstanceCtrl',
            scope: $scope.$new(true),
            resolve: {
                aliases: function(){return angular.copy($quassel.get().aliases);}
            }
        });

        modalInstance.result.then(function (aliases) {
            $quassel.onceWithTimeout('aliases', 15000, function() {
                $alert.info('Aliases saved');
            }, function() {
                $alert.error('Fail to save aliases');
            });
            $quassel.core().updateAliasManager(alias.toCoreObject(aliases));
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
    
    $scope.configHighlightRules = function() {
        $scope.highlightManager = $highlight.getManager();
        $scope.activeIndice = 0;
        modal = $uibModal.open({
            templateUrl: 'modalHighlightRuleManager.html',
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
    
    $scope.gshighlightmode = function(newValue) {
        if (arguments.length > 0) {
            $config.set('highlightmode', newValue);
            $quassel.get().options.highlightmode = newValue;
        }
        return $config.get('highlightmode', 2);
    };
    
    $scope.gsemptybufferonswitch = function(newValue) {
        if (arguments.length > 0) {
            $config.set('emptybufferonswitch', newValue);
        }
        return $config.get('emptybufferonswitch', false);
    };
    
    $scope.gsemptybufferonswitchvalue = function(newValue) {
        if (arguments.length > 0) {
            $config.set('emptybufferonswitchvalue', newValue);
        }
        return $config.get('emptybufferonswitchvalue', 0);
    };
    
    $scope.gsperchathistory = function(newValue) {
        if (arguments.length > 0) {
            $config.set('perchathistory', newValue);
        }
        return $config.get('perchathistory', true);
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
        $scope.activeIndice = indice;
    };

    $scope.deleteSelectedIgnoreItem = function() {
        $ignore.deleteItem($scope.activeIndice);
        $scope.ignoreList = $ignore.getList();
    };
    
    $scope.createHighlightRule = function() {
        $highlight.createRule();
        $scope.highlightManager = $highlight.getManager();
    };
    
    $scope.deleteSelectedHighlightRule = function() {
        $highlight.deleteRule($scope.activeIndice);
        $scope.highlightManager = $highlight.getManager();
    };
    
    $scope.cancelHighlightManager = function() {
        $highlight.restoreSavedManager();
        modal.dismiss('close');
    };

    $scope.saveHighlightManager = function() {
        $highlight.setManager($scope.highlightManager);
        $highlight.save();
        modal.dismiss('close');
    };

    $quassel.once('ignorelist', function(list) {
        $scope.$apply(function(){
            $scope.displayIgnoreListConfigItem = true;
        });
    });
    
    $quassel.once('highlightrules', function(list) {
        $scope.$apply(function(){
            $scope.displayHighlightConfigItem = true;
        });
    });
    
    $quassel.on('identities.init', function() {
        $scope.$apply(function(){
            $scope.displayIdentitiesConfigItem = true;
        });
        if ($quassel.get().identities.size === 0) {
            $scope.configIdentities();
        }
    });
}])
.controller('QuasselController', ['$scope', '$quassel', '$timeout', '$window', '$alert', '$config', '$favico', '$rootScope', '$uibModal',
            function($scope, $quassel, $timeout, $window, $alert, $config, $favico, $rootScope, $uibModal) {
    $scope.disconnected = false;
    $scope.connecting = false;
    $scope.logged = false;
    $scope.secure = null;
    $scope.remember = $config.get('remember') || false;
    $scope.host = $scope.remember ? $config.get('host', '') : "";
    $scope.port = $scope.remember ? $config.get('port', '') : "";
    $scope.user = $config.get('user', '');
    $scope.password = $config.get('password', '');
    $scope.securecoreconnection = $config.get('securecore', true);
    $scope.initialBacklogLimit = $config.get('initialBacklogLimit', 20);
    $scope.backlogLimit = $config.get('backlogLimit', 100);
    $scope.alert = "";
    $scope.bufferView = null;
    $scope.bufferViews = [];
    
    function updateBufferViews(bufferViewId) {
        var quassel = $quassel.get();
        if (bufferViewId === $config.get('bufferview', 0)) {
            $scope.bufferView = quassel.bufferViews.get(bufferViewId);
        }
        if (quassel.bufferViews.__mapValuesData__) {
            $scope.bufferViews = Array.from(quassel.bufferViews.__mapValuesData__);
        } else {
            $scope.bufferViews = Array.from(quassel.bufferViews.values());
        }
    }

    $rootScope.$on('defaultsettings', function() {
        $scope.securecoreconnection = $config.get('securecore', $scope.securecoreconnection);
        $scope.initialBacklogLimit = $config.get('initialBacklogLimit', $scope.initialBacklogLimit);
        $scope.backlogLimit = $config.get('backlogLimit', $scope.backlogLimit);
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
    
    $quassel.on('error', function(msg) {
        console.log('ERROR', msg);
        $alert.error(msg);
        if ($scope.connecting) {
            $quassel.disconnect();
            $scope.$apply(function(){
                $scope.connecting = false;
                $scope.disconnected = null;
            });
        }
    });
    
    $quassel.on('bufferview.init', function(bufferViewId, bufferId) {
        $scope.$applyAsync(function() {
            updateBufferViews(bufferViewId);
        });
    });
    
    $quassel.on('bufferview.bufferhidden', function(bufferViewId, bufferId) {
        $scope.$applyAsync(function() {
            updateBufferViews(bufferViewId);
        });
    });

    $quassel.on('bufferview.bufferunhide', function(bufferViewId, bufferId) {
        $scope.$applyAsync(function() {
            updateBufferViews(bufferViewId);
        });
    });
    
    $quassel.on('bufferview.orderchanged', function(bufferViewId) {
        $scope.$applyAsync(function() {
            updateBufferViews(bufferViewId);
        });
    });

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
            $scope.secure = $quassel.get().useSSL;
        });
    });
    
    $quassel.on('coreinfoinit', function(coreinfo) {
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
    
    $quassel.once('setup', function(data) {
        var modalParameters = {
            templateUrl: 'modalSetupWizard.html',
            controller: 'modalSetupWizardInstanceCtrl',
            keyboard: false,
            backdrop: 'static',
            scope: $scope.$new(true),
            size: 'lg',
            resolve: {
                data: function() {
                    return data;
                }
            }
        };
        var cb = function (result) {
            $quassel.get().setupCore(result[0], result[2], result[3], result[1]);
            $scope.user = result[2];
            $scope.password = result[3];
        };
        var modalInstance = $uibModal.open(modalParameters);
        
        $quassel.on('setupfailed', function(data) {
            $alert.error('Core configuration failed: ' + data);
            modalInstance = $uibModal.open(modalParameters);
            modalInstance.result.then(cb);
        });
    
        $quassel.once('setupok', function(data) {
            $quassel.removeAllListeners('setupfailed');
            $alert.info('Core successfully configured');
            $scope.login();
        });

        modalInstance.result.then(cb);
    });
    
    $quassel.once('bufferview.ids', function(ids) {
        if (!ids || ids.length === 0) {
            $quassel.core().createBufferView({
                sortAlphabetically: 1,
                showSearch: 0,
                networkId: 0,
                minimumActivity: 0,
                hideInactiveNetworks: 0,
                hideInactiveBuffers: 0,
                disableDecoration: 0,
                bufferViewName: 'All Chats',
                allowedBufferTypes: 15,
                addNewBuffersAutomatically: 1,
                TemporarilyRemovedBuffers: [],
                RemovedBuffers: [],
                BufferList: []
            });
        }
    });
    
    $scope.setBufferView = function(bv) {
        $scope.bufferView = bv;
        $config.set('bufferview', bv.id);
    };

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
        $config.set('securecore', $scope.securecoreconnection);
        $config.set('initialBacklogLimit', $scope.initialBacklogLimit);
        $config.set('backlogLimit', $scope.backlogLimit);
        console.log('Connecting to quasselcore');
    };
    
    $scope.comparator = function(id1, id2) {
        if ($scope.bufferView) {
            return $scope.bufferView.comparator(id1.value, id2.value);
        }
        return 0;
    };

    if ($scope.remember && $scope.user && $scope.password) {
        $scope.login();
    }
}])
.controller('InputController', ['$scope', '$quassel', '$hiddendiv', '$mirc', '$config', function($scope, $quassel, $hiddendiv, $mirc, $config) {
    
    var BufferListElement = function(value, prev, next) {
        this.prev = prev || null;
        if (this.prev !== null) {
            this.prev.next = this;
        }
        this.next = next || null;
        if (this.next !== null) {
            this.next.prev = this;
        }
        this.value = value;
        this._original_value = value;
    };

    var CircularBuffer = function(length) {
        this.first = null;
        this.last = null;
        this.current = null;
        this.max = length;
        this.length = 0;
    };
    
    var inputMessages = new Map;
    var MAX_CIRCULARBUFFER_SIZE = 50;
    var messagesHistory = new Map;
    var messagesHistoryGlobal = new CircularBuffer(MAX_CIRCULARBUFFER_SIZE * 10);
    var MT = libquassel.message.Types;

    $scope.inputmessage = '';
    $scope.nick = null;
    $scope.formattervisible = false;
    
    function getMessagesHistory(bufferid, init) {
        var history = null;
        if ($config.get('perchathistory', true)) {
            if (messagesHistory.has(bufferid)) {
                history = messagesHistory.get(bufferid);
            } else if (init) {
                history = new CircularBuffer(MAX_CIRCULARBUFFER_SIZE);
                messagesHistory.set(bufferid, history);
            }
        } else {
            history = messagesHistoryGlobal;
        }
        return history;
    }

    CircularBuffer.prototype.push = function(item, avoidSameAsLast) {
        this.current = null;
        if (avoidSameAsLast && this.hasPrevious()) {
            var isSame = this.previous() === item;
            this.current = null;
            if (isSame) {
                return;
            }
        }
        if (this.length === this.max) {
            var borrowed = this.first;
            this.first = this.first.next;
            this.first.previous = null;
            this.last.next = borrowed;
            this.last = this.last.next;
            this.last.value = item;
            this.last.next = null;
        } else {
            var ble = new BufferListElement(item, this.last);
            if (this.last !== null) {
                this.last = this.last.next;
            } else {
                this.first = ble;
                this.last = ble;
            }
            this.length += 1;
        }
    };
    
    CircularBuffer.prototype.get = function() {
        return this.current.value;
    };
    
    CircularBuffer.prototype.set = function(item) {
        this.current.value = item;
    };

    CircularBuffer.prototype.hasPrevious = function() {
        if (this.current === null) {
            return this.length > 0;
        }
        return this.current.prev !== null;
    };
    
    CircularBuffer.prototype.hasNext = function() {
        if (this.current === null) {
            return false;
        }
        return this.current.next !== null;
    };

    CircularBuffer.prototype.previous = function() {
        if (this.hasPrevious()) {
            if (this.current === null) {
                this.current = this.last;
            } else {
                this.current = this.current.prev;
            }
            return this.get();
        }
        return "";
    };

    CircularBuffer.prototype.next = function() {
        if (this.hasNext()) {
            this.current = this.current.next;
            return this.get();
        }
        this.current = null;
        return "";
    };
    
    CircularBuffer.prototype.update = function(item) {
        if (this.current === null) {
            this.push(item, true);
        } else {
            this.set(item);
        }
    };
    
    CircularBuffer.prototype.revert = function() {
        var curitem = this.first;
        while (curitem !== null) {
            curitem.value = curitem._original_value;
            curitem = curitem.next;
        }
    };
    
    CircularBuffer.prototype.clean = function() {
        this.current = null;
    };
    
    CircularBuffer.prototype.shouldUpdate = function(item) {
        return item !== "" && (this.current === null || this.current.value !== item);
    };

    $scope.addMessageHistory = function(message, bufferId) {
        var history = getMessagesHistory(bufferId, true);
        history.revert();
        history.push(message, true);
    };

    $scope.cleanMessageHistory = function(bufferId) {
        var history = getMessagesHistory(bufferId);
        if (history) {
            history.clean();
        }
    };

    $scope.showPreviousMessage = function(bufferId) {
        var history = getMessagesHistory(bufferId);
        if (history) {
            if (history.hasPrevious()) {
                if (history.shouldUpdate($scope.inputmessage)) {
                    history.update($scope.inputmessage);
                }
                var msg = history.previous();
                $scope.$apply(function(){
                    $scope.inputmessage = msg;
                });
            }
        }
    };

    $scope.showNextMessage = function(bufferId) {
        var history = getMessagesHistory(bufferId, true);
        if (history.shouldUpdate($scope.inputmessage)) {
            history.update($scope.inputmessage);
        }
        var msg = history.next();
        $scope.$apply(function(){
            $scope.inputmessage = msg;
        });
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
                    $scope.cleanMessageHistory($scope.buffer.id);
                    for (var idx in lines) {
                        $quassel.core().sendMessage($scope.buffer.getBufferInfo(), lines[idx]);
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
                if (this.tagName === 'BR') {
                    message += '\n';
                }
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
                var network = $quassel.get().networks.get(newValue.network);
                if (network) {
                    $scope.nick = network.nick;
                    valid = true;
                }
            }
        }
        if ($config.get('perchathistory', true)) {
            if (oldValue !== null) {
                inputMessages.set(oldValue, $scope.inputmessage);
            }
            if (inputMessages.has(newValue)) {
                $scope.inputmessage = inputMessages.get(newValue);
            } else {
                $scope.inputmessage = "";
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
    
    $scope.sendTab = function($event, sId, key) {
        $event.preventDefault();
        if (KeyboardEvent) {
            var el = document.getElementById(sId);
            if (el) {
                var ev = new KeyboardEvent('keydown', {"key": "Tab", "keyCode": 9});
                el.dispatchEvent(ev);
            }
        }
    };
}])
.controller('FilterController', ['$scope', '$config', function($scope, $config) {
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
    $scope.defaultFilter = angular.copy(filters);
    
    function init() {
        init_default();
        init_filters();
    }
    
    function init_default() {
        if ($config.has('filter')) {
            var filter = $config.get('filter');
            if (typeof filter === "number") {
                $scope.defaultFilter = unserializeFilter(filter);
            } else {
                // Migrate from old format
                $scope.defaultFilter = filter;
                $config.set('filter', serializeFilter(filter));
            }
        }
    }
    
    function init_filters() {
        var serialized = $config.get('filters'), elt;
        if (serialized) {
            serialized = serialized.split(',');
            for (var i=0; i<serialized.length; i++) {
                elt = serialized[i].split(':');
                bufferFilters[elt[0]] = unserializeFilter(elt[1]);
            }
        }
    }
    
    function save_filters() {
        var serialized = [];
        for (var bufferId in bufferFilters) {
            serialized.push(bufferId + ':' + serializeFilter(bufferFilters[bufferId]));
        }
        $config.set('filters', serialized.join(','));
    }
    
    function serializeFilter(filter) {
        var serialized = 0;
        angular.forEach(filter, function(value, key) {
            if (value.value) serialized = serialized | value.type;
        });
        return serialized;
    }
    
    function unserializeFilter(serialized) {
        var filter = [], filterItem;
        angular.forEach(filters, function(value, key) {
            filterItem = angular.copy(value);
            filterItem.value = (filterItem.type & serialized) > 0;
            filter.push(filterItem);
        });
        return filter;
    }

    function onCurrentFilterUpdate() {
        angular.forEach($scope.currentFilter, function(value, key) {
            $scope.currentFilter2[''+value.type] = value.value;
            if (value.label == 'Join') { // Also handle NetsplitJoin
                $scope.currentFilter2['32768'] = value.value;
            } else if (value.label == 'Quit') { // Also handle NetsplitQuit
                $scope.currentFilter2['65536'] = value.value;
            }
        });
        save_filters();
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
    
    init();

    $scope.setAsDefault = function() {
        $scope.defaultFilter = angular.copy($scope.currentFilter);
        $config.set('filter', serializeFilter($scope.defaultFilter));
    };

    $scope.useDefault = function() {
        $scope.currentFilter = angular.copy($scope.defaultFilter);
        onCurrentFilterUpdate();
    };
}]);
