/* global libquassel */
/* global KeyboardEvent */
/* global angular */
/* global $ */

angular.module('quassel')

    .controller('ConfigController', ['$scope', '$uibModal', '$theme', '$ignore', '$quassel', '$config', '$alert', '$highlight', function ($scope, $uibModal, $theme, $ignore, $quassel, $config, $alert, $highlight) {
        // $scope.activeTheme is assigned in the theme directive
        $scope.getAllThemes = $theme.getAllThemes;
        $scope.ignoreList = $ignore.getList();
        $scope.displayIgnoreListConfigItem = false;
        $scope.displayIdentitiesConfigItem = false;
        $scope.displayHighlightConfigItem = false;
        $scope.activeIndice = 0;
        var modal, dbg = libquassel.debug, alias = libquassel.alias;

        $scope.setTheme = function (theme) {
            $scope.activeTheme = theme;
            $theme.setClientTheme(theme);
        };

        $scope.configIdentities = function () {
            var modalInstance = $uibModal.open({
                templateUrl: 'modalIdentities.html',
                controller: 'ModalIdentitiesInstanceCtrl',
                scope: $scope.$new(true),
                size: 'lg',
                resolve: {
                    identities: function () {
                        var identities = $quassel.get().identities;
                        if (identities.__mapValuesData__) {
                            return angular.copy(identities.__mapValuesData__);
                        }
                        return angular.copy(Array.from(identities.values()));
                    }
                }
            });

            modalInstance.result.then(function (identities) {
                var im = new Map($quassel.get().identities), i = 0, identity, areEquals = false, acount = [0, 0, 0];
                for (; i < identities.length; i++) {
                    if (typeof identities[i].identityId === 'number' && identities[i].identityId > -1) {
                        identity = im.get(identities[i].identityId);
                        im.delete(identities[i].identityId);
                        areEquals = angular.equals(identity, identities[i]);
                        if (!areEquals) {
                            // Update identity information
                            $quassel.core().updateIdentity(identity.identityId, identities[i]);
                            acount[1] = acount[1] + 1;
                        }
                    } else {
                        // Create the new identity
                        $quassel.core().createIdentity(identities[i].identityName, identities[i]);
                        acount[0] = acount[0] + 1;
                    }
                }
                im.forEach(function (identity) {
                    $quassel.core().removeIdentity(identity.identityId);
                    acount[2] = acount[2] + 1;
                });
            });
        };

        $scope.configNetworks = function () {
            if ($quassel.get().identities.size === 0) {
                $quassel.once('identity.new', function () {
                    $scope.configNetworks();
                });
                $scope.configIdentities(function (nbcreate) {
                    if (nbcreate === 0) {
                        $quassel.removeListener('identity.new');
                    }
                });
                return;
            }

            var modalInstance = $uibModal.open({
                templateUrl: 'modalNetworks.html',
                controller: 'ModalNetworkInstanceCtrl',
                scope: $scope.$new(true),
                size: 'lg',
                resolve: {
                    $quassel: function () {
                        return $quassel;
                    },
                    networks: function () {
                        var networks = $quassel.get().networks;
                        if (networks.__mapValuesData__) {
                            return angular.copy(networks.__mapValuesData__);
                        }
                        return angular.copy(Array.from(networks.values()));
                    },
                    identities: function () {
                        var identities = $quassel.get().identities;
                        if (identities.__mapValuesData__) {
                            return angular.copy(identities.__mapValuesData__);
                        }
                        return angular.copy(Array.from(identities.values()));
                    }
                }
            });

            modalInstance.result.then(function (networks) {
                var nm = new Map($quassel.get().networks), i = 0, network, areEquals = false;
                for (; i < networks.length; i++) {
                    if (typeof networks[i].networkId === 'number' && networks[i].networkId > -1) {
                        network = nm.get(networks[i].networkId);
                        nm.delete(networks[i].networkId);
                        areEquals = angular.equals(network, networks[i]);
                        if (!areEquals) {
                            // Update network information
                            $quassel.core().setNetworkInfo(network.networkId, networks[i]);
                        }
                    } else {
                        // Create the new network
                        $quassel.core().createNetwork(networks[i].networkName, networks[i].identityId, undefined, networks[i]);
                        // TODO Check networkName duplicates
                    }
                }
                nm.forEach(function (network) {
                    $quassel.core().removeNetwork(network.networkId);
                });
            });
        };

        $scope.configAliases = function () {
            var modalInstance = $uibModal.open({
                templateUrl: 'modalAliases.html',
                controller: 'ModalAliasesInstanceCtrl',
                scope: $scope.$new(true),
                resolve: {
                    aliases: function () {
                        return angular.copy($quassel.get().aliases);
                    }
                }
            });

            modalInstance.result.then(function (aliases) {
                $quassel.onceWithTimeout('aliases', 15000, function () {
                    $alert.info('Aliases saved');
                }, function () {
                    $alert.error('Fail to save aliases');
                });
                $quassel.core().updateAliasManager(alias.toCoreObject(aliases));
            });
        };

        $scope.configIgnoreList = function () {
            $scope.ignoreList = $ignore.getList();
            $scope.activeIndice = 0;
            modal = $uibModal.open({
                templateUrl: 'modalIgnoreList.html',
                scope: $scope,
            });
        };

        $scope.configHighlightRules = function () {
            $scope.highlightManager = $highlight.getManager();
            $scope.activeIndice = 0;
            modal = $uibModal.open({
                templateUrl: 'modalHighlightRuleManager.html',
                scope: $scope,
            });
        };

        $scope.gsdisplayfullhostmask = function (newValue) {
            if (arguments.length > 0) {
                $config.set('displayfullhostmask', newValue);
            }
            return $config.get('displayfullhostmask', false);
        };

        $scope.gsdebug = function (newValue) {
            if (arguments.length > 0) {
                if (newValue) {
                    dbg.enable("qtdatastream:*,libquassel:*");
                } else {
                    dbg.disable();
                }
            }
            return $config.get('debug', false, true) ? true : false;
        };

        $scope.gshighlightmode = function (newValue) {
            if (arguments.length > 0) {
                $config.set('highlightmode', newValue);
                $quassel.get().options.highlightmode = newValue;
            }
            return $config.get('highlightmode', 2);
        };

        $scope.gsemptybufferonswitch = function (newValue) {
            if (arguments.length > 0) {
                $config.set('emptybufferonswitch', newValue);
            }
            return $config.get('emptybufferonswitch', false);
        };

        $scope.gsemptybufferonswitchvalue = function (newValue) {
            if (arguments.length > 0) {
                $config.set('emptybufferonswitchvalue', newValue);
            }
            return $config.get('emptybufferonswitchvalue', 0);
        };

        $scope.gsperchathistory = function (newValue) {
            if (arguments.length > 0) {
                $config.set('perchathistory', newValue);
            }
            return $config.get('perchathistory', true);
        };

        $scope.configGeneral = function () {
            modal = $uibModal.open({
                templateUrl: 'modalGeneralConfig.html',
                scope: $scope,
            });
        };

        $scope.cancelIgnoreList = function () {
            $ignore.restoreSavedList();
            modal.dismiss('close');
        };

        $scope.saveIgnoreList = function () {
            $ignore.setList($scope.ignoreList);
            $ignore.save();
            modal.dismiss('close');
        };

        $scope.createIgnoreItem = function () {
            $ignore.createItem();
            $scope.ignoreList = $ignore.getList();
        };

        $scope.setActiveIndice = function (indice) {
            $scope.activeIndice = indice;
        };

        $scope.deleteSelectedIgnoreItem = function () {
            $ignore.deleteItem($scope.activeIndice);
            $scope.ignoreList = $ignore.getList();
        };

        $scope.createHighlightRule = function () {
            $highlight.createRule();
            $scope.highlightManager = $highlight.getManager();
        };

        $scope.deleteSelectedHighlightRule = function () {
            $highlight.deleteRule($scope.activeIndice);
            $scope.highlightManager = $highlight.getManager();
        };

        $scope.cancelHighlightManager = function () {
            $highlight.restoreSavedManager();
            modal.dismiss('close');
        };

        $scope.saveHighlightManager = function () {
            $highlight.setManager($scope.highlightManager);
            $highlight.save();
            modal.dismiss('close');
        };

        $quassel.once('ignorelist', function (list) {
            $scope.$apply(function () {
                $scope.displayIgnoreListConfigItem = true;
            });
        });

        $quassel.once('highlightrules', function (list) {
            $scope.$apply(function () {
                $scope.displayHighlightConfigItem = true;
            });
        });

        $quassel.on('identities.init', function () {
            $scope.$apply(function () {
                $scope.displayIdentitiesConfigItem = true;
            });
            if ($quassel.get().identities.size === 0) {
                $scope.configIdentities();
            }
        });
    }])
