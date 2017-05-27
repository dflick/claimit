var app = angular.module('insurerApp', []);

app.config(function ($locationProvider) {
	$locationProvider.html5Mode(true);
});

app.controller("insurerController", ['$scope', '$location', '$http', '$q', '$window', '$timeout', function($scope, $location, $http, $q, $window, $timeout){

	$scope.curRegulator = "";
	$scope.insurers = [];
	$scope.accountList = [];
	$scope.selectedAccount = "";
	$scope.regulatorIndicator = "";

	$window.onload = function() {
		initUtils(web3);
		setStatus("");
		var regulator = MobileDevice.deployed();
		$scope.regulatorIndicator = "";

		web3.eth.getAccounts((e, accounts) => {
			if(accounts.length > 0) {

	   			$scope.accountList = accounts;
	   			$scope.selectedAccount = $scope.accountList[0];

				regulator.getRegulator({ from: $scope.selectedAccount, gas: 3000000 }).then( function(regulatorAddress) {
					if(regulatorAddress != $scope.selectedAccount) throw Error("Not a Regulator");

					$timeout( function() {
						$scope.curRegulator = regulatorAddress;
						$scope.regulatorIndicator = "Regulator";
					});
				}).catch( function(e) {
					$timeout( function() {
						$scope.curRegulator = "Not a Regulator";
					});
					console.error(e);
				});
			} else {
				$timeout( function() {
					$scope.curRegulator = "Address needed";
				});
			}
			return $scope.curRegulator;
		});
	}

	$scope.onChangeAccount = function(selectedAccount) {
		initUtils(web3);
		setStatus("");
		var regulator = MobileDevice.deployed();
		$scope.regulatorIndicator = "";

		regulator.getRegulator.call({ from: $scope.selectedAccount }).then( function(regulatorAddress) { 	
			if(regulatorAddress != $scope.selectedAccount) throw Error("Not a Regulator");

			$timeout( function() {
				$scope.curRegulator = regulatorAddress;
				$scope.regulatorIndicator = "Regulator";
			});
			return $scope.curRegulator;
		}).catch( function(e) {
			$timeout( function() {
				$scope.curRegulator = "Not a Regulator";
			});
			console.error(e);
		});
	};

	$scope.getInsurer = function(selectedAccount) {
		setStatus("");
		var insurer = MobileDevice.deployed();

		insurer.getInsurer(selectedAccount).then(function(data) {
			$timeout(function() {
				$scope.selectedAccountName = data[2];
				$scope.selectedAccountIndex = data[1];
			});
		}).catch(function(e) {
			console.error(e);
		});
	}

	$scope.addNewInsurer = function(newAddress, newName) {
		setStatus("");
		var insurer = MobileDevice.deployed();

		insurer.insurerExists.call(newAddress).then(function(exists) {
			if(exists) throw Error("Insurer exists already");

			insurer.addInsurer(newAddress, newName, { from: $scope.curRegulator, gas: 3000000 }).then( function(txnHash) {
				return web3.eth.getTransactionReceiptMined(txnHash).then( function(receipt) {
					setStatus("New Insurer added: " + newName);
				}).catch( function(e) {
					setStatus("Transaction failed.");
					console.error(e);
				});
			}).catch( function(e) {
				setStatus("Adding Insurer failed.");
				console.error(e);
			});
		}).catch(function(e) {
			setStatus("Insurer exists already");
			console.error(e);
		})
	}

	$scope.listInsurers = function() {
		setStatus("");
		var insurer = MobileDevice.deployed();
		$scope.insurerIndex = 0;
		$scope.insurers = [];

		/*
		** Set the header row into table
		*/ 
		$timeout( function() {
			$scope.insurers.push({
				insurerId: "Insurer index",
				insurerAddress: "Insurer address",
				insurerName: "Insurer name"
			});
		});

		insurer.getNextIndex.call().then( function(nextId) {
			for (var i = 1; i < nextId; i++) {
				$scope.insurerIndex++; // my ids in contract Insurance start from 1
				insurer.getInsurerAtX.call($scope.insurerIndex).then( function(values) {					
					$timeout( function() {
						$scope.insurers.push({
							insurerId: values[0],
							insurerAddress: values[1],
							insurerName: values[2]
						});
					});
				}).catch( function(e) {
					console.error(e);
				});
			}
			return $scope.insurers;
		}).catch( function(e) {
			console.error(e);
		});
	}
}]);