var myModule = angular.module('quassel');

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
                    eltToToggle.css("max-height", "0").css("overflow", "hidden");
                    self.removeClass("expanded").addClass("collapsed");
                } else {
                    eltToToggle.css("max-height", "").css("overflow", "");
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
                    var message = scope.inputmessage;
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
                            scope.inputmessage = newMessage;
                        });
                        var newTokenEnd = tokenEnd + newToken.length - token.length;
                        setCaretPosition(element[0], newTokenEnd);
                    }
                }
            });
        }
    };
});