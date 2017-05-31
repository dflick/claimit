var app = angular.module('claimitApp', []);

app.config(function($locationProvider) {
	$locationProvider.html5Mode(true);
});

app.controller("claimController",  ['$scope', '$location', '$http', '$q', '$window', '$timeout', function($scope, $location, $http, $q, $window, $timeout) {

	$scope.curInsurer = "";
	$scope.curInsurerInstance = "";
	$scope.mobiles = [];
	$scope.deviceEvents = "";
	$scope.accountList = [];
	$scope.selectedAccount = "";
	$scope.selectedAccountData = [];

	$window.onload = function() {
		initUtils(web3);
		$scope.curInsurer = "";
		$scope.curInsurerInstance = "";
		var insurerRegistry = InsurerRegistry.deployed();

    	web3.eth.getAccounts((e, accounts) => { 

    		if(accounts.length > 0) {

    			$timeout(function(){
		   			$scope.accountList = accounts;
		   			$scope.selectedAccount = $scope.accountList[0];

					insurerRegistry.getInsurer($scope.selectedAccount).then( function(instanceAddr) {
						
						if(instanceAddr == 0x0) {
							console.log("not insurer");
							return;
						}

						$timeout( function() {
							$scope.curInsurer = $scope.selectedAccount;
							$scope.curInsurerInstance = instanceAddr;
							$scope.getInsurer();
						});

					}).catch( function(e) {
						console.error(e);
					});
				});

			} else {
				throw Error("No account");
			}
        });
	}

	$scope.onChangeAccount = function(selectedAccount) {
		initUtils(web3);
		$scope.curInsurer = "";
		$scope.curInsurerInstance = "";
		var insurerRegistry = InsurerRegistry.deployed();

		insurerRegistry.getInsurer($scope.selectedAccount).then( function(instanceAddr) {
			
			if(instanceAddr == 0x0) {
				console.log("not insurer");
				return; 
			}

			$timeout( function() {
				$scope.curInsurer = $scope.selectedAccount;
				$scope.curInsurerInstance = instanceAddr;
				$scope.getInsurer();
			});

		}).catch( function(e) {
			console.error(e);
		});
	};

	$scope.getInsurer = function() {
		var insurer = Insurer.at($scope.curInsurerInstance);
		$scope.selectedAccountData = [];

		insurer.getAccount().then(function(account) {
			insurer.getName().then(function(name) {
				return insurer.getBusinessId().then(function(businessid) {
					$timeout(function() {
						$scope.selectedAccountData.push({
							account: account,
							name: name,
							bid: businessid
						});
					});
				});
			});
			return $scope.selectedAccountData;
		}).catch(function(e) {
			console.error(e);
		});
	}

	/*
	** 31.5.2017 TÄSTÄ ON HYVÄ JATKAA :)
	*/
	
	$scope.addDevice = function(imei, deviceOwner, insuranceOwner, trashed) {

		var device = MobileDevice.deployed();
		var trshed = trashed;
		if(trashed != true) trshed = false;
		else trshed = trashed;

		// NOTE TO ME: At this point. If you add a device that exists, transaction dialog in Mist
		// will inform you that you will run out of gas. So, very misleading which means that I
		// have to remember in future when error/warning appears that this is the reason. Until
		// I want to fix it.

		// NOTE TO ME: Any calls that change the state of the contract require a signed transaction. 
		// Error: invalid address, might be due to lack of account in transaction. Although not sure.
		device.addDevice(imei, deviceOwner, insuranceOwner, trshed, { from: $scope.curInsurer, gas: 3000000}).then(function(txnHash) {
				// Make sure you have initialized utilities initUtils(web3); in $window.onload function
			return web3.eth.getTransactionReceiptMined(txnHash).then(function (receipt) {
				setStatus("Device added: " + imei);
			}).catch(function (e) {
				setStatus("Transaction failed");
				console.error("Transaction failed: " + e);
			});
		}).catch(function (e) {
			setStatus("Error while adding device");
			console.error("Error while adding device: " + e);
		});
	}

	$scope.findDevice = function(imei) {
		var device = MobileDevice.deployed();
		$scope.mobiles = [];

		/*
		** Set the header row into table
		*/
		$timeout(function() {
			$scope.mobiles.push({
				imei: "Imei",
				owner: "Owner",
				insured: "Insured",
				trashed: "Trashed"
			});
		});

		device.getDevice.call(imei).then(function(mobile) {
			$timeout(function() {
				$scope.mobiles.push({
					imei: mobile[0],
					owner: mobile[1],
					insured: mobile[2],
					trashed: mobile[3]
				});
			});
			return $scope.mobiles;
		}).catch(function(e) {
			console.error(e);
		});
	}

	$scope.listDevices = function() {
		var device = MobileDevice.deployed();
		$scope.mobiles = [];

		/*
		** Set the header row into table
		*/
		$timeout(function() {
			$scope.mobiles.push({
				imei: "Imei",
				owner: "Owner",
				insured: "Insured",
				trashed: "Trashed"
			});
		});

		device.lastIndex.call().then(function(n) {
			for(i = 0; i <= n; i++) {
				device.getDeviceX.call(i).then(function(mobile) {
					$timeout(function() {
						$scope.mobiles.push({
							imei: mobile[0],
							owner: mobile[1],
							insured: mobile[2],
							trashed: mobile[3]
						});
					});
				}).catch(function(e) {
					console.error(e);
				});
			}
			return $scope.mobiles;
		}).catch(function(e) {
			console.error(e);
		});
	}
}]);