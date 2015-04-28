angular.module('quassel')
.directive('input', function ($parse) {
    return {
        restrict: 'E',
        require: '?ngModel',
        link: function (scope, element, attrs) {
            if (attrs.ngModel && attrs.value) {
                $parse(attrs.ngModel).assign(scope, attrs.value);
            }
        }
    };
})
.directive('theme', ['$theme', '$parse', function ($theme, $parse) {
    var regex = /(.*theme-).*\.css$/;
    
    return {
        require: '?defaultTheme',
        link: function (scope, element, attrs) {
            $theme.setDefaultTheme(attrs.defaultTheme);
            if ($theme.getClientTheme()) {
                scope.activeTheme = $theme.getClientTheme();
            }
            
            scope.$watch('activeTheme', function(newValue, oldValue){
                if (newValue) {
                    var href = element.attr("href");
                    href = href.replace(regex, "$1" + newValue + ".css");
                    element.attr("href", href);
                }
            });
        }
    };
}])
.directive('ngConfirmClick', function(){
    return {
        require: '?ngOkClick',
        link: function (scope, element, attrs) {
            var msg = attrs.ngConfirmClick;
            var clickAction = attrs.ngOkClick;
            element.on('click', function (event) {
                if (window.confirm(msg)) {
                    scope.$apply(clickAction);
                }
            });
        }
    };
})
.directive('toggle', function () {
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
})
.directive('markerline', function ($parse) {
    var lastElement = null;
    return {
        link: function (scope, element, attrs) {
            if ($parse(attrs.markerline)(scope)) {
                if (lastElement !== null) lastElement.remove();
                lastElement = $('<li class="markerline irc-message"><span></span><span></span><span></span></li>');
                element.after(lastElement);
            }
        }
    };
})
.directive('highlightContainer', function ($parse) {
    function compareViewport(el, parent) {
        var rect = el.getBoundingClientRect();
        if (rect.top < 0) return rect.top;
        else if ((rect.bottom - 80) > parent.clientHeight) return rect.bottom - 80 - parent.clientHeight;
        return 0;
    }
    
    return {
        link: function (scope, element, attrs) {
            
            function updateHighlights() {
                var parent = element[0], highlightTop = 0, highlightBottom = 0, val;
                $('.buffer-highlight').each(function(){
                    val = compareViewport(this, parent);
                    if (val < highlightTop) highlightTop = val;
                    if (val > highlightBottom) highlightBottom = val;
                });
                if (highlightBottom > 0) {
                    if (!element.hasClass('highlight-on-bottom')) {
                        element.addClass('highlight-on-bottom');
                    }
                } else {
                    element.removeClass('highlight-on-bottom');
                }
                if (highlightTop < 0) {
                    if (!element.hasClass('highlight-on-top')) {
                        element.addClass('highlight-on-top');
                    }
                } else {
                    element.removeClass('highlight-on-top');
                }
            }
            
            $(window).resize(updateHighlights);
            element.on('scroll', updateHighlights);
            scope.$on('highlight', updateHighlights);
        }
    };
})
.directive('caret', function() {
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
})
.directive('scrollme', [function () {
    var parent = $("ul.backlog")[0];
    var promise = null;
    return {
        link: function (scope, element, attr) {
            clearTimeout(promise);
            promise = setTimeout(function(){
                if (!element.is(':hidden')) {
                    if (parent.offsetHeight + parent.scrollTop + element.height() + 10 >= parent.scrollHeight) {
                        parent.scrollTop = parent.scrollHeight;
                    }
                }
            }, 50);
        }
    };
}])
.directive('backlog', ['$timeout', '$compile', '$socket', function (timeout, $compile, $socket) {
    return {
        scope: {
            backlog: "=",
            buffer: "=parentBuffer",
            currentFilter: "="
        },
        template: "",
        link: function (scope, element, attr) {
            var lengthThreshold = attr.scrollThreshold || 20;
            var handler = scope.backlog;
            var promiseFetching = null;
            var lastScrolled = -9999;
            var lastBottom = 0;
            scope.fetching = false;
            
            element.before($compile('<div class="fetching" ng-show="fetching">Fetching more backlogs...</div>')(scope));
            
            lengthThreshold = parseInt(lengthThreshold, 10);

            if (!handler || !angular.isFunction(handler)) {
                handler = angular.noop;
            }
            
            function clearFetching() {
                if (promiseFetching !== null) timeout.cancel(promiseFetching);
                // In case no response for 30 seconds, reset fetching to false
                promiseFetching = timeout(function () {
                    scope.fetching = false;
                }, 30000);
            }
            
            scope.$watch('currentFilter', function(newValue, oldValue) {
                tryLaunchHandler();
            }, true);
            
            scope.$watch('buffer', function(newValue, oldValue){
                tryLaunchHandler();
            });
            
            $socket.on('buffer.backlog', function(bufferId, messageIds) {
                if (scope.buffer !== null && bufferId == scope.buffer.id) {
                    timeout(function () {
                        element[0].scrollTop = element[0].scrollHeight - lastBottom;
                        if (element[0].scrollTop < lengthThreshold) {
                            // If no scrollbar (or scrollTop to small), load more backlogs
                            launchHandler();
                        }
                    }, 10);
                }
                if (promiseFetching !== null) timeout.cancel(promiseFetching);
                scope.fetching = false;
            });
            
            function tryLaunchHandler() {
                if (promiseFetching !== null) timeout.cancel(promiseFetching);
                scope.fetching = false;
                lastBottom = 0;
                element[0].scrollTop = element[0].scrollHeight;
                timeout(function () {
                    if (element[0].scrollTop < lengthThreshold) {
                        launchHandler();
                    }
                }, 0);
            }
            
            function launchHandler() {
                if (!scope.fetching) {
                    lastBottom = element[0].scrollHeight;
                }
                timeout(function () {
                    if (handler() === true) {
                        scope.fetching = true;
                        clearFetching();
                    }
                }, 10);
            }

            element.bind('scroll', function(){
                var scrolled = element[0].scrollTop;
                // if we have reached the threshold and we scroll up
                if (scrolled < lengthThreshold && (scrolled - lastScrolled) < 0) {
                    launchHandler();
                }
                lastScrolled = scrolled;
            });
        }
    };
}]);