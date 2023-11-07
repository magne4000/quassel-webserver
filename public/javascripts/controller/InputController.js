/* global libquassel */
/* global KeyboardEvent */
/* global angular */
/* global $ */

angular.module('quassel')
    .controller('InputController', ['$scope', '$quassel', '$hiddendiv', '$mirc', '$config', function ($scope, $quassel, $hiddendiv, $mirc, $config) {

        var BufferListElement = function (value, prev, next) {
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

        var CircularBuffer = function (length) {
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

        CircularBuffer.prototype.push = function (item, avoidSameAsLast) {
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

        CircularBuffer.prototype.get = function () {
            return this.current.value;
        };

        CircularBuffer.prototype.set = function (item) {
            this.current.value = item;
        };

        CircularBuffer.prototype.hasPrevious = function () {
            if (this.current === null) {
                return this.length > 0;
            }
            return this.current.prev !== null;
        };

        CircularBuffer.prototype.hasNext = function () {
            if (this.current === null) {
                return false;
            }
            return this.current.next !== null;
        };

        CircularBuffer.prototype.previous = function () {
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

        CircularBuffer.prototype.next = function () {
            if (this.hasNext()) {
                this.current = this.current.next;
                return this.get();
            }
            this.current = null;
            return "";
        };

        CircularBuffer.prototype.update = function (item) {
            if (this.current === null) {
                this.push(item, true);
            } else {
                this.set(item);
            }
        };

        CircularBuffer.prototype.revert = function () {
            var curitem = this.first;
            while (curitem !== null) {
                curitem.value = curitem._original_value;
                curitem = curitem.next;
            }
        };

        CircularBuffer.prototype.clean = function () {
            this.current = null;
        };

        CircularBuffer.prototype.shouldUpdate = function (item) {
            return item !== "" && (this.current === null || this.current.value !== item);
        };

        $scope.addMessageHistory = function (message, bufferId) {
            var history = getMessagesHistory(bufferId, true);
            history.revert();
            history.push(message, true);
        };

        $scope.cleanMessageHistory = function (bufferId) {
            var history = getMessagesHistory(bufferId);
            if (history) {
                history.clean();
            }
        };

        $scope.showPreviousMessage = function (bufferId) {
            var history = getMessagesHistory(bufferId);
            if (history) {
                if (history.hasPrevious()) {
                    if (history.shouldUpdate($scope.inputmessage)) {
                        history.update($scope.inputmessage);
                    }
                    var msg = history.previous();
                    $scope.$apply(function () {
                        $scope.inputmessage = msg;
                    });
                }
            }
        };

        $scope.showNextMessage = function (bufferId) {
            var history = getMessagesHistory(bufferId, true);
            if (history.shouldUpdate($scope.inputmessage)) {
                history.update($scope.inputmessage);
            }
            var msg = history.next();
            $scope.$apply(function () {
                $scope.inputmessage = msg;
            });
        };

        $scope.sendMessage = function () {
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
                        bold: $mirc.isBold(cs['font-weight']) || modifiersByLevel[level - 1].bold,
                        italic: $mirc.isItalic(cs['font-style']) || modifiersByLevel[level - 1].italic,
                        underline: $mirc.isUnderline(cs['text-decoration']) || modifiersByLevel[level - 1].underline,
                        color: [
                            $mirc.getMIRCValidColor(cs['color']) || modifiersByLevel[level - 1].color[0],
                            $mirc.getMIRCValidColor(cs['background-color']) || modifiersByLevel[level - 1].color[1]
                        ]
                    };
                    if (this.tagName === 'BR') {
                        message += '\n';
                    }
                } else if (this.nodeType === 3) {  // Text Node
                    message += applyModifiersToString(modifiersByLevel[level - 1], contextModifiers, rootModifiers);
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

        $scope.execCommand = function (value) {
            document.execCommand(value, false, null);
        };

        $scope.$watch('buffer', function (newValue, oldValue) {
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

        $quassel.on('network.mynick', function (networkId, newNick) {
            if ($scope.buffer && $scope.buffer.network === parseInt(networkId, 10)) {
                $scope.$apply(function () {
                    $scope.nick = newNick;
                });
            }
        });

        $scope.sendTab = function ($event, sId, key) {
            $event.preventDefault();
            if (KeyboardEvent) {
                var el = document.getElementById(sId);
                if (el) {
                    var ev = new KeyboardEvent('keydown', { "key": "Tab", "keyCode": 9 });
                    el.dispatchEvent(ev);
                }
            }
        };
    }])
