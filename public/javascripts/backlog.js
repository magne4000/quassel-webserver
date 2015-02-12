// inspired by https://github.com/lorenzofox3/lrInfiniteScroll
(function (ng) {
    'use strict';
    var module = ng.module('backlog', []);
    module.directive('backlog', ['$timeout', '$compile', function (timeout, $compile) {
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

                if (!handler || !ng.isFunction(handler)) {
                    handler = ng.noop;
                }
                
                scope.$watch('fetching', function(newValue, oldValue){
                    if (promiseFetching !== null) timeout.cancel(promiseFetching);
                    if (newValue === true) {
                        // In case no response for 30 seconds, reset fetching to false
                        promiseFetching = timeout(function () {
                            scope.fetching = false;
                        }, 30000);
                    }
                });
                
                scope.$watch('currentFilter', function(newValue, oldValue) {
                    tryLaunchHandler();
                }, true);
                
                scope.$watch('buffer', function(newValue, oldValue){
                    tryLaunchHandler();
                });
                
                scope.$watch('buffer.messages', function(newValue, oldValue){
                    if (!oldValue || !newValue || (oldValue && newValue && oldValue.count() !== newValue.count())) {
                        timeout(function () {
                            element[0].scrollTop = element[0].scrollHeight - lastBottom;
                            if (element[0].scrollTop < lengthThreshold) {
                                // If no scrollbar (or scrollTop to small), load more backlogs
                                launchHandler();
                            }
                        }, 0);
                    }
                    scope.fetching = false;
                }, true);
                
                function tryLaunchHandler() {
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
})(angular);