/* global libquassel */
/* global KeyboardEvent */
/* global angular */
/* global $ */

angular.module('quassel')

    .controller('QuasselController', ['$scope', '$quassel', '$timeout', '$window', '$alert', '$config', '$favico', '$rootScope', '$uibModal',
        function ($scope, $quassel, $timeout, $window, $alert, $config, $favico, $rootScope, $uibModal) {
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

            $rootScope.$on('defaultsettings', function () {
                $scope.securecoreconnection = $config.get('securecore', $scope.securecoreconnection);
                $scope.initialBacklogLimit = $config.get('initialBacklogLimit', $scope.initialBacklogLimit);
                $scope.backlogLimit = $config.get('backlogLimit', $scope.backlogLimit);
            });

            $scope.$watch('alert', function (newValue, oldValue) {
                if (newValue !== "") {
                    $timeout(function () {
                        $scope.alert = "";
                    }, 8000);
                }
            });

            $scope.$watch('remember', function (newValue, oldValue) {
                $config.set('remember', newValue);
                if (!newValue) {
                    $config.del('host');
                    $config.del('port');
                }
            });

            $scope.$watch('disconnected', function (newValue, oldValue) {
                if (newValue) {
                    $favico.reset();
                }
            });

            $quassel.on('error', function (msg) {
                console.log('ERROR', msg);
                $alert.error(msg);
                if ($scope.connecting) {
                    $quassel.disconnect();
                    $scope.$apply(function () {
                        $scope.connecting = false;
                        $scope.disconnected = null;
                    });
                }
            });

            $quassel.on('bufferview.init', function (bufferViewId, bufferId) {
                $scope.$applyAsync(function () {
                    updateBufferViews(bufferViewId);
                });
            });

            $quassel.on('bufferview.bufferhidden', function (bufferViewId, bufferId) {
                $scope.$applyAsync(function () {
                    updateBufferViews(bufferViewId);
                });
            });

            $quassel.on('bufferview.bufferunhide', function (bufferViewId, bufferId) {
                $scope.$applyAsync(function () {
                    updateBufferViews(bufferViewId);
                });
            });

            $quassel.on('bufferview.orderchanged', function (bufferViewId) {
                $scope.$applyAsync(function () {
                    updateBufferViews(bufferViewId);
                });
            });

            $quassel.on('ws.end', function () {
                console.log('DISCONNECTED');
                $scope.$apply(function () {
                    $scope.connecting = false;
                    $scope.disconnected = true;
                });
                try {
                    $quassel.disconnect();
                } catch (e) {
                    console.warn(e);
                }
            });

            $quassel.on('loginfailed', function () {
                console.log('loginfailed');
                $scope.$apply(function () {
                    $scope.connecting = false;
                    $scope.alert = "Invalid username or password.";
                });
            });

            $quassel.on('login', function () {
                console.log('Logged in');
                $scope.$apply(function () {
                    $scope.connecting = false;
                    $scope.logged = true;
                    $scope.secure = $quassel.get().useSSL;
                });
            });

            $quassel.on('coreinfoinit', function (coreinfo) {
                if (coreinfo.CoreFeatures && coreinfo.CoreFeatures < 4) {
                    $alert.error('Your quasselcore is not supported by quassel-webserver (version too old)');
                }
            });

            $quassel.on('disconnect', function () {
                console.log('DISCONNECT');
                $scope.$apply(function () {
                    $scope.disconnected = true;
                });
            });

            $quassel.on('reconnect', function () {
                console.log('RECONNECT');
                if ($scope.logged) {
                    $scope.login();
                }
                $scope.$apply(function () {
                    $scope.disconnected = false;
                });
            });

            $quassel.once('setup', function (data) {
                var modalParameters = {
                    templateUrl: 'modalSetupWizard.html',
                    controller: 'modalSetupWizardInstanceCtrl',
                    keyboard: false,
                    backdrop: 'static',
                    scope: $scope.$new(true),
                    size: 'lg',
                    resolve: {
                        data: function () {
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

                $quassel.on('setupfailed', function (data) {
                    $alert.error('Core configuration failed: ' + data);
                    modalInstance = $uibModal.open(modalParameters);
                    modalInstance.result.then(cb);
                });

                $quassel.once('setupok', function (data) {
                    $quassel.removeAllListeners('setupfailed');
                    $alert.info('Core successfully configured');
                    $scope.login();
                });

                modalInstance.result.then(cb);
            });

            $quassel.once('bufferview.ids', function (ids) {
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

            $scope.setBufferView = function (bv) {
                $scope.bufferView = bv;
                $config.set('bufferview', bv.id);
            };

            $scope.reload = function () {
                $window.location.reload();
            };

            $scope.logout = function () {
                $scope.remember = false;
                $scope.reload();
            };

            $scope.login = function () {
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

            $scope.comparator = function (id1, id2) {
                if ($scope.bufferView) {
                    return $scope.bufferView.comparator(id1.value, id2.value);
                }
                return 0;
            };

            if ($scope.remember && $scope.user && $scope.password) {
                $scope.login();
            }
        }])
