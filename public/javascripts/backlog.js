// inspired by https://github.com/lorenzofox3/lrInfiniteScroll
(function (ng) {
    'use strict';
    var module = ng.module('backlog', []);
    module.directive('backlog', ['$timeout', function (timeout) {
        return {
            scope: {
                backlog: "=",
                buffer: "=parentBuffer"
            },
            link: function (scope, element, attr) {
                var lengthThreshold = attr.scrollThreshold || 20;
                var timeThreshold = attr.timeThreshold || 300;
                var handler = scope.backlog;
                var promise = null;
                var lastScrolled = -9999;
                var lastBottom = 0;
                var fetching = false;

                lengthThreshold = parseInt(lengthThreshold, 10);
                timeThreshold = parseInt(timeThreshold, 10);

                if (!handler || !ng.isFunction(handler)) {
                    handler = ng.noop;
                }
                
                scope.$watch('buffer', function(oldValue, newValue){
                    fetching = false;
                    lastBottom = 0;
                    element[0].scrollTop = element[0].scrollHeight;
                    timeout(function () {
                        if (element[0].scrollHeight === element[0].clientHeight) {
                            launchHandler();
                        }
                    }, 0);
                });
                
                scope.$watch('buffer.messages', function(oldValue, newValue){
                    if (!oldValue || !newValue || (oldValue && newValue && oldValue.count() !== newValue.count())) {
                        timeout(function () {
                            element[0].scrollTop = element[0].scrollHeight - lastBottom;
                        }, 0);
                    }
                    fetching = false;
                }, true);
                
                function launchHandler() {
                    // if there is already a timer running which has no expired yet we have to cancel it and restart the timer
                    if (promise !== null) {
                        timeout.cancel(promise);
                    }
                    if (!fetching) {
                        lastBottom = element[0].scrollHeight - element[0].scrollTop;
                    }
                    promise = timeout(function () {
                        if (handler() === true) {
                            fetching = true;
                        }
                        promise = null;
                    }, timeThreshold);
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
;