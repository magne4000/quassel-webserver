/* global libquassel */
/* global KeyboardEvent */
/* global angular */
/* global $ */

angular.module('quassel')
    .controller('NetworkController',
        ['$scope', '$quassel', '$uibModal', '$favico', '$alert', '$desktop', '$wfocus', '$ignore', '$config', '$responsive', '$highlight',
            function ($scope, $quassel, $uibModal, $favico, $alert, $desktop, $wfocus, $ignore, $config, $responsive, $highlight) {
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
                    while (!networkItem.done) {
                        if (!networkItem.value.isStatusBuffer) {
                            network._buffers.push(networkItem.value);
                        }
                        networkItem = it.next();
                    }
                }

                function createDayChangeMessage(msg, timestamp) {
                    var message = new IRCMessage({
                        id: msg.id,
                        timestamp: timestamp / 1000,
                        type: MT.DAYCHANGE,
                        flags: MF.SERVERMSG,
                        bufferInfo: {
                            network: msg.networkId,
                            id: msg.bufferId
                        }
                    });
                    message.sid = msg.id + timestamp;
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
                    messages.sort(function (a, b) {
                        return a.id - b.id;
                    });
                    // Add missing DayChange messages between existing messages
                    // and apply ignore list
                    for (i = 0; i < messages.length; i++) {
                        messages[i].sid = messages[i].id;
                        currentMessageDay = new Date(messages[i].datetime).setHours(0, 0, 0, 0);
                        currentMessage = messages[i];
                        if (isIgnored(currentMessage, buffer)) {
                            messages.splice(i--, 1);
                        }
                        if (i > 0) {
                            interval = (currentMessageDay - lastMessageDay) / 86400000;
                            for (j = interval; j > 0; j--) {
                                messages.splice(i++, 0, createDayChangeMessage(lastMessage, currentMessageDay - ((j - 1) * 86400000)));
                            }
                        }
                        lastMessageDay = currentMessageDay;
                        lastMessage = currentMessage;

                    }
                    interval = (today - lastMessageDay) / 86400000;
                    // Add missing DayChange messages after last message
                    for (j = 0; j < interval; j++) {
                        messages.push(createDayChangeMessage(lastMessage, lastMessageDay + ((j + 1) * 86400000)));
                    }
                    return messages;
                }

                function checkURLOptions() {
                    let fragments = window.location.hash.substr(1).split("&");
                    let wantedChannelName = "";
                    let wantedNetworkName = "";
                    fragments.forEach(function (fragment) {
                        let option = fragment.split("=");
                        if (typeof option[1] !== 'undefined') {
                            if (option[0] === "channel") wantedChannelName = option[1];
                            if (option[0] === "network") wantedNetworkName = option[1];
                        }
                    });

                    $scope.networks.forEach(function (network) {
                        if (network.networkName === wantedNetworkName) {
                            network._buffers.forEach(function (channel) {
                                if (channel.name === wantedChannelName) $scope.showBuffer(channel);
                            });
                        }
                    });
                }

                $quassel.on('init', function (obj) {
                    $scope.networkscount = obj.SessionState.NetworkIds.length;
                    $scope.networks = [];
                });

                $quassel.on('network.init', function (networkId) {
                    var network = this.networks.get(networkId);
                    $scope.$applyAsync(function () {
                        network.collapsed = !network.isConnected;
                        $scope.networks.push(network);
                        $scope.networkscount = $scope.networks.length;
                        checkURLOptions();
                    });
                });

                $quassel.on('network.remove', function (networkId) {
                    var index = null;
                    for (var i = 0; i < $scope.networks.length; i++) {
                        if ($scope.networks[i].networkId === networkId) {
                            index = i;
                            break;
                        }
                    }
                    if (index !== null) {
                        $scope.$apply(function () {
                            $scope.networks.splice(index, 1);
                        });
                    }
                });

                $quassel.on('network.addbuffer', function (networkId, bufferId) {
                    var network = this.networks.get(networkId);
                    _updateBuffers(network);
                });

                $quassel.on('network.disconnected', function (networkId) {
                    var network = this.networks.get(networkId);
                    $scope.$apply(function () {
                        network.collapsed = true;
                    });
                });

                $quassel.on('network.connected', function (networkId) {
                    var network = this.networks.get(networkId);
                    $scope.$apply(function () {
                        network.collapsed = false;
                    });
                });

                $quassel.on('buffer.backlog', function (bufferId, messageIds) {
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
                        $scope.$apply(function () {
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

                $quassel.on('buffer.lastseen', function (bufferId, messageId) {
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

                $quassel.on('buffer.markerline', function (bufferId, messageId) {
                    var buffer = this.networks.getBuffer(bufferId);
                    if (buffer) {
                        $scope.$apply(function () {
                            buffer.markerline = parseInt(messageId, 10);
                        });
                    }
                });

                $quassel.on('buffer.activity', function (bufferId, activity) {
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

                $quassel.on('buffer.message', function (bufferId, messageId) {
                    var buffer = this.networks.getBuffer(bufferId);
                    if (buffer) {
                        var message = buffer.messages.get(parseInt(messageId, 10));
                        if ($scope.buffer !== null && buffer.id === $scope.buffer.id && $wfocus.isFocus()) {
                            $quassel.markBufferAsRead(bufferId, messageId);
                        } else {
                            if (!$wfocus.isFocus() && $scope.buffer !== null && buffer.id === $scope.buffer.id) {
                                $wfocus.onNextFocus(function () {
                                    $quassel.markBufferAsRead(bufferId, messageId);
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

                $quassel.on('buffer.read', function (bufferId) {
                    var buffer = this.networks.getBuffer(bufferId);
                    if (buffer) {
                        while (buffer.favico > 0) {
                            $favico.less();
                            buffer.favico--;
                        }
                        setHighlight(buffer, 0);
                    }
                });

                $quassel.on('buffer.remove', function (bufferId) {
                    var networks = this.networks;
                    $scope.$apply(function () {
                        networks.forEach(function (network) {
                            _updateBuffers(network);
                        });
                    });
                });

                $quassel.on('buffer.merge', function (bufferId1, bufferId2) {
                    var buffer1 = this.networks.getBuffer(bufferId1);
                    var network = this.networks.get(buffer1.network);
                    $scope.$apply(function () {
                        network._buffers = network.networks.values();
                        _updateBuffers(network);
                    });
                });

                $quassel.on('ignorelist', function (list) {
                    $ignore.setList(list);
                    $ignore.incRevision();
                    $scope.$apply(function () {
                        updateMessages();
                    });
                });

                $quassel.on('highlightrules', function (manager) {
                    $highlight.setManager(manager);
                    $highlight.incRevision();
                });

                $quassel.on('buffer.rename', function () {
                    $scope.$apply();
                });

                $scope.showBuffer = function (channel) {
                    if (channel && $scope.buffer === channel) return;
                    var olfbuf = $scope.buffer;
                    $scope.buffer = channel;
                    if ($scope.buffer !== null) {
                        updateMessages();
                        if ($responsive.getBreakpoint() !== 'xs') {
                            $('#messagebox').focus();
                        }
                        $quassel.markBufferAsRead(channel.id, channel.lastMessageId);

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

                $scope.loadMore = function () {
                    if ($scope.buffer !== null
                        && (!loadingMoreBacklogs.has($scope.buffer.id)
                            || loadingMoreBacklogs.get($scope.buffer.id) === false)
                        && loadingMoreBacklogs.get($scope.buffer.id) !== 'stop') {
                        var firstMessageId = $scope.buffer.firstMessageId;
                        loadingMoreBacklogs.set($scope.buffer.id, true);
                        if (!firstMessageId) firstMessageId = -1;
                        $quassel.moreBacklogs($scope.buffer.id, firstMessageId);
                        return true;
                    }
                    return false;
                };

                $scope.connect = function (network) {
                    $quassel.core().connectNetwork(network.networkId);
                };

                $scope.disconnect = function (network) {
                    $quassel.core().disconnectNetwork(network.networkId);
                };

                $scope.openModalJoinChannel = function (network) {
                    var modalInstance = $uibModal.open({
                        templateUrl: 'modalJoinChannel.html',
                        controller: 'ModalJoinChannelInstanceCtrl',
                        resolve: {
                            network: function () {
                                return network;
                            }
                        }
                    });

                    modalInstance.result.then(function (name) {
                        $quassel.core().sendMessage(network.statusBuffer.getBufferInfo(), '/join ' + name);
                    });
                };

                $scope.channelPart = function (channel) {
                    $quassel.core().sendMessage(channel.getBufferInfo(), '/part');
                };

                $scope.channelJoin = function (channel) {
                    $quassel.core().sendMessage(channel.getBufferInfo(), '/join ' + channel.name);
                };

                $scope.channelDelete = function (channel) {
                    $quassel.core().removeBuffer(channel.id);
                };

                $scope.onDropComplete = function (dragged, dropped) {
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

                $scope.channelHidePermanently = function (channel) {
                    $quassel.core().hideBufferPermanently($scope.bufferView.id, channel.id);
                };

                $scope.channelHideTemporarily = function (channel) {
                    $quassel.core().hideBufferTemporarily($scope.bufferView.id, channel.id);
                };

                $scope.channelUnhide = function (channel) {
                    $quassel.core().unhideBuffer($scope.bufferView.id, channel.id);
                };

                $scope.cycleHiddenState = function (channel) {
                    if ($scope.bufferView.isPermanentlyRemoved(channel.id)) {
                        $scope.channelUnhide(channel);
                    } else if ($scope.bufferView.isTemporarilyRemoved(channel.id)) {
                        $scope.channelHidePermanently(channel);
                    } else {
                        $scope.channelHideTemporarily(channel);
                    }
                };

                $scope.openModalRenameBuffer = function (buffer) {
                    var modalInstance = $uibModal.open({
                        templateUrl: 'modalRenameBuffer.html',
                        controller: 'ModalRenameBufferInstanceCtrl',
                        resolve: {
                            name: function () {
                                return buffer.name;
                            }
                        }
                    });

                    modalInstance.result.then(function (name) {
                        if (name) {
                            $quassel.core().renameBuffer(buffer.id, name);
                        }
                    });
                };

                $scope.userQuery = function (user) {
                    var network = $quassel.get().networks.get($scope.buffer.network);
                    var buffer;
                    if (network !== null) {
                        buffer = network.getBuffer(user.nick);
                        if (buffer) {
                            $scope.showBuffer(buffer);
                        } else {
                            $quassel.once('network.addbuffer', function (networkId, bufferId) {
                                network = $quassel.get().networks.get(networkId);
                                buffer = network.getBuffer(bufferId);
                                if (buffer) {
                                    $scope.$apply(function () {
                                        $scope.showBuffer(buffer);
                                    });
                                }
                            });
                            $quassel.core().sendMessage($scope.buffer.getBufferInfo(), '/query ' + user.nick);
                        }
                    }
                };

                $scope.userClass = function (buffer, nick) {
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

                $scope.whois = function (user) {
                    if ($scope.buffer !== null) {
                        $quassel.core().sendMessage($scope.buffer.getBufferInfo(), '/whois ' + user.nick);
                    }
                };

                $scope.toggleShowHide = function () {
                    $scope.showhidden = !$scope.showhidden;
                };
            }])
