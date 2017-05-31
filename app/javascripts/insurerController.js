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
		var regulator = Regulator.deployed();
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
		var regulator = Regulator.deployed();
		$scope.regulatorIndicator = "";

		regulator.getRegulator({ from: $scope.selectedAccount }).then( function(regulatorAddress) { 	
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

	$scope.addNewInsurer = function(newAddress, newName) {
		setStatus("");
		var insurer = Claimit.deployed();

		insurer.addInsurer(newAddress, newName, newBusinessID, { from: $scope.curRegulator, gas: 3000000 }).then( function(txnHash) {
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
	}

	$scope.listInsurers = function() {
		setStatus("");
		var insurerRegistry = InsurerRegistry.deployed();

		$scope.insurerIndex = 0;
		$scope.insurers = [];

		// Set the header row into table

		$timeout( function() {
			$scope.insurers.push({
				insurerAddress: "Insurer address",
				insurerName: "Insurer name"
			});
		});

		insurerRegistry.getInsurers().then(function(reg) {

			for(var i=0; i<reg.length; i++) {
				// this has to be constant for some reason
				const insurer = Insurer.at(reg[i]);

				insurer.getAccount().then(function(acc) {
					return insurer.getName().then(function(nm) {
						$timeout(function() {
							$scope.insurers.push({
								insurerAddress: acc,
								insurerName: nm
							});
						});
					});
				}).catch(function(e) {
					console.error(e);
				});
			}
			return $scope.insurers;
		}).catch(function(e) {
			console.error(e);
		});
	}
}]);