var app = angular.module('mobileDeviceApp', []);

app.config(function($locationProvider) {
	$locationProvider.html5Mode(true);
});

app.controller("mobileDeviceController",  ['$scope', '$location', '$http', '$q', '$window', '$timeout', function($scope, $location, $http, $q, $window, $timeout) {

	$scope.curInsurer = "";
	$scope.mobiles = [];
	$scope.deviceEvents = "";
	$scope.accountList = [];
	$scope.selectedAccount = "";
	$scope.selectedAccountData = [];

	$window.onload = function() {
		initUtils(web3);
		var insurer = MobileDevice.deployed();

    	web3.eth.getAccounts((e, accounts) => { 
    		if(accounts.length > 0) {
	   			$scope.accountList = accounts;
	   			$scope.selectedAccount = $scope.accountList[0];

//				$timeout( function() {
					insurer.insurerExists.call($scope.selectedAccount).then( function(exists) {
						if(!exists) throw Error("Only Insurer is allowed to add devices");
						$timeout( function() {
							$scope.curInsurer = $scope.selectedAccount;
						});
					}).catch( function(e) {
						$timeout( function() {
							$scope.curInsurer = "Only Insurer is allowed to add devices";
						});
						console.error(e);
					});
//				});
			} else {
				$timeout( function() {
					$scope.curInsurer = "Insurer needed";
				});
			}
			$timeout(function() {
				$scope.getInsurer();
			});
        });
	}

	$scope.onChangeAccount = function(selectedAccount) {
		initUtils(web3);
		var insurer = MobileDevice.deployed();

		$timeout( function() {
			insurer.insurerExists.call($scope.selectedAccount).then( function(exists) {
				if(!exists) throw Error("Only Insurer is allowed to add devices");
				$timeout( function() {
					$scope.curInsurer = $scope.selectedAccount;
				});
			}).catch( function(e) {
				$timeout( function() {
					$scope.curInsurer = "Only Insurer is allowed to add devices";
				});
				console.error(e);
			});
		});
		$scope.getInsurer();
	};

	$scope.getInsurer = function() {
		var insurer = MobileDevice.deployed();
		$scope.selectedAccountData = [];

		insurer.getInsurer.call($scope.selectedAccount).then(function(data) {
			$scope.selectedAccountData.push({
				index: data[0],
				address: data[1],
				name: data[2]
			});
			return $scope.selectedAccountData;
		}).catch(function(e) {
			console.error(e);
		});
	}


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