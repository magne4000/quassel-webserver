/* global angular */
/* global Intl */
/* global $ */

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
.directive('colorpicker', ['$mirc', function($mirc) {
    return {
        restrict: 'E',
        transclude: true,
        scope: {},
        require: '?colopickerMode',
        template: '<span ng-transclude></span>' +
        '<ul class="colors">' +
            '<li ng-repeat="color in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]">' +
                '<button type="button" class="btn btn-xs mirc-bg-{{color}}" ng-click="setColor(color)"></button>' +
            '</li>' +
        '</ul>',
        link: function (scope, element, attrs) {
            var mode = null;
            if (attrs.colopickerMode == 'foreColor' || attrs.colopickerMode == 'backColor') {
                mode = attrs.colopickerMode;
            } else {
                return;
            }

            scope.setColor = function(colorInd) {
                var color = $mirc.getColorByMIRCInd(colorInd);
                document.execCommand(mode, false, color);
            };
        }
    };
}])
.directive('ircMessage', ['$filter', '$parse', '$compile', '$sanitize', function($filter, $parse, $compile){

    var MT = require('libquassel/lib/message').Type;
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

    function nickplaceholder(sender) {
        var nickhash = $filter('hash')(sender);
        sender = sender.replace('"', '\\"');
        return '<span data-nickhash="' + nickhash + '" ng-nick="' + sender + '"></span>';
    }
    
    function escapecurlybraces(subject) {
      return subject.replace(/{{/g, '{<!---->{').replace(/}}/g, '}<!---->}');
    }

    function getmessagetemplate(message, scope) {
        var content, arr, servers, shouldCompile = true;
        switch(message.type) {
            case MT.Topic:
                content = $filter('linky')(message.content, '_blank');
                shouldCompile = false;
                break;
            case MT.Action:
            case MT.Plain:
                content = $filter('linky')(message.content, '_blank', {'class': 'check-embed'});
                content = $filter('color')(content);
                break;
            case MT.Nick:
                if (message.sender === message.content) {
                    content = "You are now known as " +  nickplaceholder(message.content);
                } else {
                    content = nickplaceholder(message.sender) + " is now known as " + nickplaceholder(message.content);
                }
                break;
            case MT.Mode:
                content = "Mode " + message.content + " by " + nickplaceholder(message.sender);
                break;
            case MT.Join:
                content = nickplaceholder(message.sender) + " has joined";
                break;
            case MT.Part:
                if (message.content) {
                    content = nickplaceholder(message.sender) + " has left (" + $filter('linky')(message.content, '_blank') + ")";
                } else {
                    content = nickplaceholder(message.sender) + " has left";
                }
                break;
            case MT.Quit:
                if (message.content) {
                    content = nickplaceholder(message.sender) + " has quit (" + $filter('linky')(message.content, '_blank') + ")";
                } else {
                    content = nickplaceholder(message.sender) + " has quit";
                }
                break;
            case MT.Kick:
                var ind = message.content.indexOf(" ");
                content = nickplaceholder(message.sender) + " has kicked " + message.content.slice(0, ind) + " (" + message.content.slice(ind+1) + ")";
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
                shouldCompile = false;
                break;
            default:
                content = message.content === null ? '' : message.content;
                shouldCompile = false;
        }
        if (shouldCompile) {
            return $compile('<span>' + escapecurlybraces(content) + '</span><br>')(scope);
        }
        return content + '<br>';
    }

    return {
        restrict: 'E',
        require: '?message',
        link: function (scope, element, attrs) {
            var message = $parse(attrs.message)(scope);
            element.html(getmessagetemplate(message, scope));
        }
    };
}])
.directive('ngNick', ['$filter', '$rootScope', '$config', function ($filter, $rootScope, $config) {
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
.directive('theme', ['$theme', function ($theme) {
    var regex = /(.*theme-).*\.css$/;

    return {
        link: function (scope, element, attrs) {
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
.directive('ircMarkerline', function () {
    var lastElement = null;
    return {
        link: function (scope, element, attrs) {
            if (lastElement !== null) lastElement.remove();
            lastElement = element;
        }
    };
})
.directive('highlightContainer', function () {
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
                $('.buffer-highlight-high').each(function(){
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
.directive('caret', [function() {
    var MT = require('libquassel/lib/message').Type;

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
    
    function getRangeBoundingClientRect(elem) {
        return window.getSelection().getRangeAt(0).getBoundingClientRect();
    }
    
    function getInnerBoundingClientRect(elem) {
        var rect = elem.getBoundingClientRect();
        var style = window.getComputedStyle(elem, null);
        return {
            top: rect.top + parseInt(style.getPropertyValue('padding-top'), 10),
            right: rect.right - parseInt(style.getPropertyValue('padding-right'), 10),
            bottom: rect.bottom - parseInt(style.getPropertyValue('padding-bottom'), 10),
            left: rect.left + parseInt(style.getPropertyValue('padding-left'), 10),
            width: rect.width
        };
    }

    function getCaretPosition(elem) {
        var range = window.getSelection().getRangeAt(0);
        var preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(elem);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        var start = preSelectionRange.toString().length;
        
        return {
            start: start,
            end: start + range.toString().length
        };
    }

    function setCaretPosition(elem, caretPos, caretPosEnd) {
        if (elem !== null) {
            var charIndex = 0, range = document.createRange();
            range.setStart(elem, 0);
            range.collapse(true);
            var nodeStack = [elem], node, foundStart = false, foundEnd = (typeof caretPosEnd === "undefined") ? true : false;

            while (!(foundStart && foundEnd) && (node = nodeStack.pop())) {
                if (node.nodeType == 3) {
                    var nextCharIndex = charIndex + node.length;
                    if (!foundStart && caretPos >= charIndex && caretPos <= nextCharIndex) {
                        range.setStart(node, caretPos - charIndex);
                        foundStart = true;
                    }
                    if (!foundEnd && caretPosEnd >= charIndex && caretPosEnd <= nextCharIndex) {
                        range.setEnd(node, caretPosEnd - charIndex);
                        foundEnd = true;
                    }
                    charIndex = nextCharIndex;
                } else {
                    var i = node.childNodes.length;
                    while (i--) {
                        nodeStack.push(node.childNodes[i]);
                    }
                }
            }

            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    // Find the most recent nick who has talked.
    function getMostRecentNick(scope, token) {
        if (!scope.buffer) return [];

        var keys = Array.from(scope.buffer.messages.keys()), nicks = [], ltoken = token.toLowerCase();
        keys.sort();
        keys.reverse();

        for (var i = 0; i < keys.length; i++) {
            var messageId = keys[i];
            var message = scope.buffer.messages.get(messageId);

            // Only check Plain and Action messages for nicks.
            if (!(message.type == MT.Plain || message.type == MT.Action))
                continue;

            var nick = message.getNick();
            if (nick.length < token.length)
                continue;

            if (!scope.buffer.users.has(nick))
                continue;

            if (ltoken == nick.toLowerCase().substr(0, ltoken.length)) {
                nicks.push(nick);
            }
        }
        return uniq(nicks);
    }

    // Find the closet nick alphabetically from the current buffer's nick list.
    function completeNicksAlphabetically(nicks, scope, token) {
        if (!scope.buffer) return nicks;

        var subjects = Array.from(scope.buffer.users.keys()), ltoken = token.toLowerCase();
        if (subjects.length === 0) {
            subjects = [scope.buffer.name, scope.nick];
        }
        subjects.sort(function(a, b) {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });

        for (var i = 0; i < subjects.length; i++) {
            var nick = subjects[i];
            if (nick.length < token.length)
                continue;

            if (ltoken == nick.toLowerCase().substr(0, ltoken.length) && nicks.indexOf(nick) === -1) {
                nicks.push(nick);
            }
        }
        return uniq(nicks);
    }

    function getTokenCompletion(scope, token, tokenStart) {
        var nicks = getMostRecentNick(scope, token), pos = 0;
        nicks = completeNicksAlphabetically(nicks, scope, token);
        if (nicks.length === 0)
            return null;
        return function() {
            var nick = nicks[pos];
            pos = (pos + 1) % nicks.length;
            return tokenStart === 0 ? nick + ':\xa0' /* non-breaking space */ : nick;
        };
    }
    
    function CompletionState() {
        this._token = null;
        this._tokens = null;
        this._end = null;
        this._original = null;
    }
    
    CompletionState.prototype.end = function() {
        this._token = null;
        this._tokens = null;
        this._end = null;
        this._original = null;
    };
    
    CompletionState.prototype.start = function(o, token, tokens, e) {
        this._original = o;
        this._token = token;
        this._tokens = tokens;
        this._end = e;
    };
    
    CompletionState.prototype.hasTokens = function() {
        return this._tokens !== null;
    };
    
    CompletionState.prototype.next = function() {
        return this._tokens();
    };

    return {
        link: function(scope, element, attrs) {
            var completion = new CompletionState();

            // Nick completion
            element.on('blur', completion.end.bind(completion));
            element.on('keydown', function($event) {
                if ($event.keyCode == 9) { // Tab
                    $event.preventDefault();
                    var token = "", newTokens = null, tokenStart = null, elementHtml = element.html(), message = element[0].innerText;
                    if (!completion.hasTokens()) {
                        var carentEnd = getCaretPosition(element[0]).end;
                        var messageLeft = message.substr(0, getCaretPosition(element[0]).end);
                        var match = messageLeft.match(/[^#\w\d-_\[\]{}|`^.\\]/gi);
                        tokenStart = !match ? 0 : messageLeft.lastIndexOf(match[match.length - 1]) + 1;
                        token = messageLeft.substr(tokenStart);
                        newTokens = getTokenCompletion(scope, token, tokenStart);
                        completion.start(elementHtml, token, newTokens, carentEnd);
                    }
                    if (completion.hasTokens()) {
                        var newToken = completion.next();
                        element.html(completion._original);
                        if (completion._token.length > 0) {
                            setCaretPosition(element[0], completion._end - completion._token.length, completion._end);
                        } else {
                            setCaretPosition(element[0], completion._end);
                        }
                        document.execCommand("insertText", false, newToken);
                    } else {
                        completion.end();
                    }
                } else {
                    if ($event.keyCode == 38) { // Arrow up
                        var bdrange = getRangeBoundingClientRect(element[0]);
                        var bdinput = getInnerBoundingClientRect(element[0]);
                        if (bdrange.top - bdinput.top <= 5) {
                            $event.preventDefault();
                            scope.showPreviousMessage(scope.buffer.id);
                        }
                    } else if ($event.keyCode == 40) { // Arrow down
                        var bdrange = getRangeBoundingClientRect(element[0]);
                        var bdinput = getInnerBoundingClientRect(element[0]);
                        if ((bdrange.top === 0 && bdrange.left === 0) || bdinput.bottom - bdrange.bottom <= 5) {
                            $event.preventDefault();
                            scope.showNextMessage(scope.buffer.id);
                        }
                    }
                    completion.end();
                }
            });
        }
    };
}])
.directive('backlog', ['$timeout', '$compile', '$quassel', '$parse', function (timeout, $compile, $quassel, $parse) {
    return {
        link: function (scope, element, attr) {
            var lengthThreshold = attr.scrollThreshold || 20;
            var handler = $parse(attr.backlog)(scope);
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
}])
.directive('focusonfocus', [function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            $(window).focus(function() {
                setTimeout(function() {
                    element.focus();
                }, 15);
            });
        }
    };
}])
.directive('contenteditable', ['$sce', function($sce) {
    return {
        restrict: 'A', // only activate on element attribute
        require: '?ngModel', // get a hold of NgModelController
        link: function(scope, element, attrs, ngModel) {
            if (!ngModel) return; // do nothing if no ng-model

            // Specify how UI should be updated
            ngModel.$render = function() {
                element.html($sce.getTrustedHtml(ngModel.$viewValue || ''));
            };

            if (attrs.mimicInput) {
                element.on('keydown', function(e) {
                    if (e.which == 13 && e.shiftKey == false) {
                        setTimeout(submit, 0);
                        return false;
                    }
                });
            }

            element.on('paste', function (e){
                e.preventDefault();
                document.execCommand("insertText", false, (e.originalEvent || e).clipboardData.getData("text/plain"));
            });

            // Listen for change events to enable binding
            element.on('blur keyup change', function() {
                scope.$evalAsync(read);
            });
            read(); // initialize

            // Write data to the model
            function read() {
                var html = element.html();
                // When we clear the content editable the browser leaves a <br> behind
                // If strip-br attribute is provided then we strip this out
                if (attrs.mimicInput && html == '<br>') {
                    html = '';
                }
                ngModel.$setViewValue(html);
            }

            function submit() {
                read();
                element.trigger('submit');
            }
        }
    };
}])
.directive('convertToNumber', function() {
  return {
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {
      ngModel.$parsers.push(function(val) {
        return parseInt(val, 10);
      });
      ngModel.$formatters.push(function(val) {
        return '' + val;
      });
    }
  };
})
.directive('arrayToTextarea', function() {
  return {
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {
      ngModel.$parsers.push(function(val) {
        if (!val) return '';
        return val.split('\n');
      });
      ngModel.$formatters.push(function(val) {
        if (!val) return '';
        return val.join('\n');
      });
    }
  };
})
.directive('stringToNumber', function() {
  return {
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {
      ngModel.$parsers.push(function(value) {
        return '' + value;
      });
      ngModel.$formatters.push(function(value) {
        return parseFloat(value, 10);
      });
    }
  };
})
.directive('divideBy', function() {
  return {
    require: 'ngModel',
    scope: {
      value: "=divideBy"
    },
    link: function(scope, element, attrs, ngModel) {
      
      if ((attrs.type === 'number') && ngModel) {
        delete ngModel.$validators.step;
      }
      
      ngModel.$parsers.push(function(value) {
        return value * scope.value;
      });
      ngModel.$formatters.push(function(value) {
        if (!scope.value) return 0;
        return value / scope.value;
      });
    }
  };
})
.directive('compareTo', function() {
  return {
    require: "ngModel",
    scope: {
      otherModelValue: "=compareTo"
    },
    link: function(scope, element, attributes, ngModel) {
      ngModel.$validators.compareTo = function(modelValue) {
        return modelValue == scope.otherModelValue;
      };
      scope.$watch("otherModelValue", function() {
        ngModel.$validate();
      });
    }
  };
})
.directive('unique', function() {
  return {
    restrict: 'A',
    scope: {
      unique: "&"
    },
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.unique = function(modelValue, viewValue) {
        return scope.unique({model: viewValue});
      };
    }
  };
})
.directive('dropdownContextmenu', [function() {
  
  function getPosition(e, elm, dropdownMenu, rightalign) {
    var css = {};
    var elmrect = elm[0].getBoundingClientRect();
    var x = e.pageX - elmrect.left;
    var y = e.pageY - elmrect.top;
    var wd = dropdownMenu[0].offsetWidth;
    var we = elm[0].offsetWidth;
    
    css.top = y + 'px';
    if (rightalign) {
      if (x - wd < 0) {
        css.right = (we - wd) + 'px';
      } else {
        css.right = (we - x) + 'px';
      }
    } else {
      if (x + wd > we) {
        css.left = (we - wd) + 'px';
      } else {
        css.left = x + 'px';
      }
    }
    
    return css;
  }
  
  return {
    require: 'uibDropdown',
    link: function(scope, elm, attrs, dropdownCtrl) {
      var rightalign = dropdownCtrl.dropdownMenu.hasClass('dropdown-menu-right');
      var restore = null;
      
      elm.on('contextmenu', function(e) {
        e.preventDefault();
        if (restore === null) {
          var style = dropdownCtrl.dropdownMenu[0].style;
          restore = {
            top: style.top,
            left: style.left,
            right: style.right
          };
        }
        
        dropdownCtrl.toggle(true);
        scope.$apply();
        
        var css = getPosition(e, elm, dropdownCtrl.dropdownMenu, rightalign);
        dropdownCtrl.dropdownMenu.css(css);
      });
      
      scope.$watch(function() {
        if (restore !== null && !dropdownCtrl.isOpen()) {
          dropdownCtrl.dropdownMenu[0].style.top = restore.top;
          dropdownCtrl.dropdownMenu[0].style.left = restore.left;
          dropdownCtrl.dropdownMenu[0].style.right = restore.right;
          restore = null;
        }
      });
    }
  };
}])
.directive('checkEmbed', ['$embed', '$compile', function($embed, $compile) {
  var template_label = '<span class="label label-default irc-embed-label" ng-click="action()"><i title="{{title}}" class="icon-qws" ng-class="icon"></i></span>';
  var template_embed = '<li class="irc-embed">' +
    '<div class="row">' +
      '<small>{{pluginid}}</small>' +
      '<button type="button" ng-click="hide()" class="close">×</button>' +
    '</div>' +
    '<div class="embed row" ng-class="category" ng-bind-html="html"></div>' +
  '</li>';
  
  function insertEmbed(scope, el, html) {
    var newscope = scope.$new();
    newscope.html = html;
    var compiled = $compile(template_embed)(newscope);
    compiled.insertAfter(el.parents('.irc-message'));
  }
  
  return {
    restrict: 'C',
    scope: true,
    link: function(scope, element, attributes) {
      var pluginAndMatch = $embed.getPluginAndMatch(attributes.href);
      if (pluginAndMatch) {
        var plugin = pluginAndMatch[0];
        var match = pluginAndMatch[1];
        
        scope.category = plugin.category;
        scope.pluginid = plugin.id;
        
        scope.load = function() {
          $embed.exec(plugin.getHtml, match, function(html) {
            scope.clearAndShow();
            insertEmbed(scope, element, html);
          });
        };
        
        scope.clearAndShow = function() {
          scope._hide_part1();
          for (var i=0; i<scope.$parent.links.length; i++) {
            scope.$parent.links[i]._hide_part2();
          }
          scope.show();
        };
        
        scope.hide = function() {
          scope._hide_part1();
          scope._hide_part2();
        };
        
        scope._hide_part1 = function() {
          element.parents('.irc-message').next('.irc-embed').remove();
        };
        
        scope._hide_part2 = function() {
          scope.icon = 'icon-resize-full';
          scope.title = 'show';
          scope.action = scope.load;
          element.css('text-decoration', '');
        };
        
        scope.show = function() {
          scope.icon = 'icon-resize-small';
          scope.title = 'hide';
          scope.action = scope.hide;
          element.css('text-decoration', 'underline');
        };
        
        scope._hide_part2();
        
        if (!scope.$parent.links) {
          scope.$parent.links = [];
        }
        scope.$parent.links.push(scope);

        var newel = $compile(template_label)(scope);
        newel.insertAfter(element);
      }
    }
  };
}]);
