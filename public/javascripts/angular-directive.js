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
.directive('ircMessage', ['$compile', '$filter', function($compile, $filter){
    
    var MT = require('message').Type;
    var dateFormat;
    if (typeof Intl != "undefined" && Intl.DateTimeFormat) {
        dateFormat = new Intl.DateTimeFormat(undefined, {weekday: "long", year: "numeric", month: "long", day: "numeric"});
    } else {
        dateFormat = {
            format: function(date) {
                return date.toDateString();
            }
        };
    }
    
    function nickplaceholder(val) {
        if (typeof val != 'undefined') {
            var nickhash=$filter('hash')(val);
            val = val.replace('"', '\\"');
            return '<span data-nickhash="'+nickhash+'" ng-nick="'+val+'"></span>';
        }
        return '<span data-nickhash="{{::message.sender | hash}}" ng-nick="{{::message.sender}}"></span>';
    }
    
    function getmessagetemplate(scope, message) {
        var content, arr, servers;
        switch(message.type) {
            case MT.Plain:
                content = $filter('color')($filter('linky')(message.content, '_blank'));
                break;
            case MT.Nick:
                content = nickplaceholder() + " is now known as {{::message.content}}";
                break;
            case MT.Mode:
                content = "Mode {{::message.content}} by " + nickplaceholder();
                break;
            case MT.Join:
                content = nickplaceholder() + " has joined";
                break;
            case MT.Part:
                content = nickplaceholder() + " has left (" + message.content + ")";
                break;
            case MT.Quit:
                content = nickplaceholder() + " has quit (" + message.content + ")";
                break;
            case MT.Kick:
                var ind = message.content.indexOf(" ");
                content = nickplaceholder() + " has kicked " + message.content.slice(0, ind) + " (" + message.content.slice(ind+1) + ")";
                break;
            case MT.NetsplitJoin:
                arr = message.content.split("#:#");
                servers = arr.pop().split(" ");
                content = "Netsplit between " + servers[0] + " and " + servers[1] + " ended. Users joined: " + arr.map(nickplaceholder).join(', ');
                break;
            case MT.NetsplitQuit:
                arr = message.content.split("#:#");
                servers = arr.pop().split(" ");
                content = "Netsplit between " + servers[0] + " and " + servers[1] + ". Users quit: " + arr.map(nickplaceholder).join(', ');
                break;
            case MT.DayChange:
                content = "{Day changed to " + dateFormat.format(message.datetime) + "}";
                break;
            default:
                content = "{{::message.content}}";
        }
        return content + '<br>';
    }
    
    return {
        scope: {
            message: "="
        },
        restrict: 'E',
        require: '?message',
        link: function (scope, element, attrs) {
            var msg = getmessagetemplate(scope, scope.message);
            element.html(msg);
            $compile(element.contents())(scope);
        }
    };
}])
.directive('ngNick', ['$filter', '$compile', '$rootScope', '$config', function ($filter, $compile, $rootScope, $config) {
    return {
        scope: {},
        link: function (scope, element, attrs) {
            if ($config.get('displayfullhostmask')) {
                scope.nick = attrs.ngNick;
            } else {
                scope.nick = $filter('stripnick')(attrs.ngNick);
            }
            
            var deregister = $rootScope.$on('config.displayfullhostmask', function(evt, newValue) {
                if (!newValue) {
                    scope.nick = $filter('stripnick')(attrs.ngNick);
                } else {
                    scope.nick = attrs.ngNick;
                }
            });
            
            scope.$on('$destroy', deregister);
        },
        template: "{{nick}}"
    };
}])
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
.directive('ircMarkerline', function ($parse) {
    var lastElement = null;
    return {
        link: function (scope, element, attrs) {
            if (lastElement !== null) lastElement.remove();
            lastElement = element;
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
    
    function uniq(a) {
        var seen = {};
        var out = [];
        var len = a.length;
        var j = 0;
        for (var i = 0; i < len; i++) {
             var item = a[i];
             if (seen[item] !== 1) {
                   seen[item] = 1;
                   out[j++] = item;
             }
        }
        return out;
    }
    
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
    
    // Find the most recent nick who has talked.
    function getMostRecentNick(scope, token) {
        if (!scope.buffer) return [];

        var keys = scope.buffer.messages.keys(), nicks = [];
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
            
            if (!(nick in scope.buffer.nickUserMap))
                continue;

            if (token.toLowerCase() == nick.toLowerCase().substr(0, token.length)) {
                nicks.push(nick);
            }
        }
        return uniq(nicks);
    }
    
    // Find the closet nick alphabetically from the current buffer's nick list.
    function getNickAlphabetically(scope, token) {
        if (!scope.buffer) return [];

        var subjects = Object.keys(scope.buffer.nickUserMap), nicks = [];
        subjects.sort(function(a, b) {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });

        for (var i = 0; i < subjects.length; i++) {
            var nick = subjects[i];
            if (nick.length <= token.length)
                continue;

            if (token.toLowerCase() == nick.toLowerCase().substr(0, token.length)) {
                nicks.push(nick);
            }
        }
        return uniq(nicks);
    }
    
    function getTokenCompletion(scope, token, tokenStart) {
        var nicks = getMostRecentNick(scope, token), pos = 0;
        if (nicks.length === 0)
            nicks = getNickAlphabetically(scope, token);
        if (nicks.length === 0)
            return null;
        return function() {
            var nick = nicks[pos];
            pos = (pos + 1) % nicks.length;
            return tokenStart === 0 ? nick + ': ' : nick;
        };
    }

    return {
        link: function(scope, element, attrs) {
            var lastTokens = null, lastTokenStart = null, lastTokenEnd = null;
            
            // Nick completion
            element.on('blur', function(){
                lastTokens = null;
                lastTokenStart = null;
                lastTokenEnd = null;
            });
            element.on('keydown', function($event) {
                if ($event.keyCode == 9) { // Tab
                    $event.preventDefault();
                    var newTokens = null, tokenStart = null, tokenEnd = null;
                    var message = scope.inputmessage;
                    var messageLength = message.length;
                    if (lastTokens !== null) {
                        newTokens = lastTokens;
                        tokenStart = lastTokenStart;
                        tokenEnd = lastTokenEnd;
                    } else {
                        tokenEnd = element[0].selectionEnd;
                        var messageLeft = message.substr(0, tokenEnd);
                        tokenStart = messageLeft.lastIndexOf(' ') + 1;
                        var token = messageLeft.substr(tokenStart);
                        newTokens = getTokenCompletion(scope, token, tokenStart);
                    }

                    if (newTokens) {
                        var newToken = newTokens();
                        var newMessage = message.substr(0, tokenStart) + newToken + message.substr(tokenEnd);
                        scope.$apply(function(){
                            scope.inputmessage = newMessage;
                        });
                        var newTokenEnd = tokenEnd + newMessage.length - messageLength;
                        setCaretPosition(element[0], newTokenEnd);
                        
                        lastTokens = newTokens;
                        lastTokenStart = tokenStart;
                        lastTokenEnd = newTokenEnd;
                    }
                } else {
                    lastTokens = null;
                    lastTokenStart = null;
                    lastTokenEnd = null;
                    if ($event.keyCode == 38) { // Arrow up
                        $event.preventDefault();
                        scope.showPreviousMessage(scope.buffer.id);
                    } else if ($event.keyCode == 40) { // Arrow down
                        $event.preventDefault();
                        scope.showNextMessage(scope.buffer.id);
                    }
                }
            });
        }
    };
})
.directive('scrollme', [function () {
    var parent = $("ul.backlog")[0];
    var promise = null;
    var heightsum = 0;
    return {
        link: function (scope, element, attr) {
            clearTimeout(promise);
            if (element.is(':last-child')) {
                heightsum += element.height();
                promise = setTimeout(function(){
                    if (!element.is(':hidden')) {
                        if (parent.offsetHeight + parent.scrollTop + heightsum + 10 >= parent.scrollHeight) {
                            parent.scrollTop = parent.scrollHeight;
                            heightsum = 0;
                        }
                    }
                }, 50);
            }
        }
    };
}])
.directive('backlog', ['$timeout', '$compile', '$quassel', function (timeout, $compile, $quassel) {
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
            var promiseScroll = null;
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
            
            $quassel.on('buffer.backlog', function(bufferId, messageIds) {
                if (scope.buffer !== null && bufferId == scope.buffer.id) {
                    timeout(function () {
                        timeout(function () { // Wait for 2 ticks
                            element[0].scrollTop = element[0].scrollHeight - lastBottom;
                            if (element[0].scrollTop < lengthThreshold) {
                                launchHandler();
                            }
                        }, 5);
                    }, 5);
                }
                if (promiseFetching !== null) timeout.cancel(promiseFetching);
                scope.fetching = false;
            });
            
            function tryLaunchHandler() {
                if (promiseFetching !== null) timeout.cancel(promiseFetching);
                scope.fetching = false;
                timeout(function () {
                    element[0].scrollTop = element[0].scrollHeight;
                    if (element[0].scrollTop < lengthThreshold) {
                        launchHandler();
                    }
                }, 0);
            }
            
            function launchHandler() {
                if (!scope.fetching) {
                    lastBottom = element[0].scrollHeight - element[0].scrollTop;
                }
                timeout(function () {
                    if (handler() === true) {
                        scope.fetching = true;
                        clearFetching();
                    }
                }, 10);
            }

            element.bind('scroll', function(){
                if (promiseScroll !== null) timeout.cancel(promiseScroll);
                promiseScroll = timeout(function () {
                    var scrolled = element[0].scrollTop;
                    // if we have reached the threshold and we scroll up
                    if (scrolled < lengthThreshold && (scrolled - lastScrolled) < 0) {
                        launchHandler();
                    }
                    lastScrolled = scrolled;
                }, 10);
            });
        }
    };
}])
.directive('tokenField', ['$parse', function($parse) {
    return {
        require: '?ngModel',
        link: function (scope, element, attr) {
            element.tokenfield({
                delimiter: ";",
                createTokensOnBlur: true,
                tokens: $parse(attr.ngModel)(scope)
            });
        }
    };
}]);
