/* global libquassel */
/* global KeyboardEvent */
/* global angular */
/* global $ */

angular.module('quassel')
    .controller('FilterController', ['$scope', '$config', function ($scope, $config) {
        var filters = [
            { label: 'Join', type: 32, value: false },
            { label: 'Part', type: 64, value: false },
            { label: 'Quit', type: 128, value: false },
            { label: 'Nick', type: 8, value: false },
            { label: 'Mode', type: 16, value: false },
            { label: 'Topic', type: 16384, value: false },
            { label: 'DayChange', type: 8192, value: false },
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
                for (var i = 0; i < serialized.length; i++) {
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
            angular.forEach(filter, function (value, key) {
                if (value.value) serialized = serialized | value.type;
            });
            return serialized;
        }

        function unserializeFilter(serialized) {
            var filter = [], filterItem;
            angular.forEach(filters, function (value, key) {
                filterItem = angular.copy(value);
                filterItem.value = (filterItem.type & serialized) > 0;
                filter.push(filterItem);
            });
            return filter;
        }

        function onCurrentFilterUpdate() {
            angular.forEach($scope.currentFilter, function (value, key) {
                $scope.currentFilter2['' + value.type] = value.value;
                if (value.label == 'Join') { // Also handle NetsplitJoin
                    $scope.currentFilter2['32768'] = value.value;
                } else if (value.label == 'Quit') { // Also handle NetsplitQuit
                    $scope.currentFilter2['65536'] = value.value;
                }
            });
            save_filters();
        }

        $scope.$watch('buffer', function (newValue, oldValue) {
            if (oldValue !== null) {
                bufferFilters['' + oldValue.id] = angular.copy($scope.currentFilter);
            }
            if ((newValue !== null && oldValue === null) || (newValue !== null && oldValue !== null && newValue.id !== oldValue.id)) {
                if (typeof bufferFilters['' + newValue.id] === 'undefined') {
                    bufferFilters['' + newValue.id] = angular.copy($scope.defaultFilter);
                }
                $scope.currentFilter = bufferFilters['' + newValue.id];
                onCurrentFilterUpdate();
            }
        });

        $scope.$watch('currentFilter', onCurrentFilterUpdate, true);

        init();

        $scope.setAsDefault = function () {
            $scope.defaultFilter = angular.copy($scope.currentFilter);
            $config.set('filter', serializeFilter($scope.defaultFilter));
        };

        $scope.useDefault = function () {
            $scope.currentFilter = angular.copy($scope.defaultFilter);
            onCurrentFilterUpdate();
        };
    }]);
