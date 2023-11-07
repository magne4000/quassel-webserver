/* global libquassel */
/* global KeyboardEvent */
/* global angular */
/* global $ */

angular.module('quassel')

    .controller('ModalJoinChannelInstanceCtrl', function ($scope, $uibModalInstance, network) {
        $scope.name = '';
        $scope.network = network;

        $scope.ok = function () {
            $uibModalInstance.close($scope.name);
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
    })
    .controller('ModalRenameBufferInstanceCtrl', function ($scope, $uibModalInstance, name) {
        $scope.name = name;

        $scope.ok = function () {
            $uibModalInstance.close($scope.name);
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
    })
    .controller('ModalAliasesInstanceCtrl', function ($scope, $uibModalInstance, aliases) {
        var alias = libquassel.alias;
        $scope.aliases = aliases;

        $scope.ok = function () {
            $uibModalInstance.close($scope.aliases);
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.add = function () {
            $scope.aliases.push(new alias.AliasItem("", ""));
        };

        $scope.remove = function (ind) {
            $scope.aliases.splice(ind, 1);
        };

        $scope.isAliasUnique = function (aliases, name, index) {
            var i = 0;
            for (i; i < aliases.length; i++) {
                if (i === index) continue;
                if (aliases[i].name === name) {
                    return false;
                }
            }
            return true;
        };
    })
    .controller('ModalIdentitiesInstanceCtrl', function ($scope, $uibModalInstance, identities) {
        $scope.identities = identities;
        $scope.activeCategoryIndex = 0;
        $scope.activeIdentityIndex = 0;

        $scope.selectIdentity = function (index) {
            $scope.activeIdentityIndex = index;
        };

        $scope.selectCategory = function (index) {
            $scope.activeCategoryIndex = index;
        };

        $scope.createNick = function () {
            $scope.identities[$scope.activeIdentityIndex].nicks.push('');
        };

        $scope.deleteNick = function (nick) {
            $scope.identities[$scope.activeIdentityIndex].nicks.splice($scope.identities[$scope.activeIdentityIndex].nicks.indexOf(nick), 1);
        };

        $scope.moveNick = function (indexFrom, indexTo) {
            var tmp = $scope.identities[$scope.activeIdentityIndex].nicks[indexTo];
            $scope.identities[$scope.activeIdentityIndex].nicks[indexTo] = $scope.identities[$scope.activeIdentityIndex].nicks[indexFrom];
            $scope.identities[$scope.activeIdentityIndex].nicks[indexFrom] = tmp;
        };

        $scope.createIdentity = function () {
            var identity = {
                autoAwayEnabled: true,
                autoAwayReason: "Not here. No, really. not here!",
                autoAwayReasonEnabled: false,
                autoAwayTime: 10,
                awayNick: "",
                awayNickEnabled: false,
                awayReason: "Gone fishing.",
                awayReasonEnabled: true,
                detachAwayEnabled: false,
                detachAwayReason: "All Quassel clients vanished from the face of the earth...",
                detachAwayReasonEnabled: true,
                ident: "quassel",
                identityName: "New identity",
                kickReason: "Kindergarten is elsewhere!",
                nicks: ["qws-user-" + (Math.floor(Math.random() * 9999))],
                partReason: "http://quassel-irc.org - Chat comfortably. Anywhere.",
                quitReason: "http://quassel-irc.org - Chat comfortably. Anywhere.",
                realName: ""
            };
            $scope.identities.push(identity);
        };

        $scope.deleteActiveIdentity = function () {
            $scope.identities.splice($scope.activeIdentityIndex, 1);
        };

        $scope.saveIdentities = function () {
            $uibModalInstance.close($scope.identities);
        };

        // At initialization, if we have no identity, just add one so the user doesn't have an empty modal
        if ($scope.identities.length === 0) {
            $scope.createIdentity();
        }
    })
    .controller('ModalNetworkInstanceCtrl', function ($scope, $uibModalInstance, $quassel, networks, identities) {
        $scope.networks = networks;
        $scope.identities = identities;
        $scope.activeNetworkIndex = 0;
        $scope.activeServerIndex = 0;
        $scope.activeServer = null;

        $scope.useSSLStateChanged = function (activeServer) {
            if (activeServer.UseSSL) {
                if (activeServer.Port == 6667) activeServer.Port = 6697;
            } else {
                if (activeServer.Port == 6697) activeServer.Port = 6667;
            }
        };

        $scope.saveNetworks = function () {
            $uibModalInstance.close($scope.networks);
        };

        $scope.selectServer = function (network, index) {
            $scope.activeServerIndex = index;
            $scope.activeServer = network.ServerList[index];
        };

        $scope.addServer = function (network) {
            network.ServerList.push({
                Host: '',
                Port: 6667,
                Password: '',
                UseSSL: false,
                sslVersion: 0,
                UseProxy: false,
                ProxyType: '',
                ProxyHost: '',
                ProxyPort: '',
                ProxyUser: '',
                ProxyPass: '',
                sslVerify: 1
            });
            return true;
        };

        $scope.createNetwork = function () {
            $scope.networks.push({
                networkName: 'New network',
                identityId: $scope.identities[0].identityId,
                ServerList: [],
                codecForServer: '',
                codecForEncoding: '',
                codecForDecoding: '',
                useRandomServer: false,
                perform: [],
                useAutoIdentify: false,
                autoIdentifyService: 'NickServ',
                autoIdentifyPassword: '',
                useSasl: false,
                saslAccount: '',
                saslPassword: '',
                useAutoReconnect: true,
                autoReconnectInterval: 60,
                autoReconnectRetries: 20,
                unlimitedReconnectRetries: false,
                rejoinChannels: true,
                useCustomMessageRate: false,
                unlimitedMessageRate: false,
                msgRateMessageDelay: 2200,
                msgRateBurstSize: 5
            });
            $scope.addServer($scope.networks[$scope.networks.length - 1]);
            setTimeout(function () {
                $scope.$apply(function () {
                    $scope.activeNetworkIndex = $scope.networks.length - 1;
                });
            }, 10);
            return true;
        };

        $scope.deleteActiveNetwork = function () {
            $scope.networks.splice($scope.activeNetworkIndex, 1);
        };

        $scope.deleteServer = function (network, index) {
            network.ServerList.splice(index, 1);
            $scope.selectServer(network, 0);
        };

        $scope.supportSslVerify = $quassel.supports($quassel.Features.VERIFYSERVERSSL);
        $scope.supportCustomRateLimits = $quassel.supports($quassel.Features.CUSTOMRATELIMITS);

        // At initialization, if we have no network, just add one so the user doesn't have an empty modal
        if ($scope.networks.length === 0) {
            $scope.createNetwork();
        }
    })
    .controller('modalSetupWizardInstanceCtrl', function ($scope, $uibModalInstance, data) {
        $scope.step = 0;
        $scope.username = '';
        $scope.password = '';
        $scope.repeatpassword = '';
        $scope.backends = data;
        $scope.selectedBackend = null;
        $scope.properties = {};

        $scope.moveStep = function (moveto) {
            $scope.step = moveto;
        };

        $scope.commit = function () {
            var properties = {}, key;
            for (var i = 0; i < $scope.selectedBackend.SetupKeys.length; i++) {
                key = $scope.selectedBackend.SetupKeys[i];
                properties[key] = $scope.selectedBackend.SetupDefaults[key] || '';
                if ($scope.properties[key]) {
                    properties[key] = $scope.properties[key];
                }
            }
            $uibModalInstance.close([$scope.selectedBackend.DisplayName, properties, $scope.username, $scope.password]);
        };
    })
