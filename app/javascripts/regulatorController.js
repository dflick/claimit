var app = angular.module('regulatorApp', []);

app.config(function ($locationProvider) {
	$locationProvider.html5Mode(true);
});

app.controller("regulatorController", ['$scope', '$location', '$http', '$q', '$window', '$timeout', function($scope, $location, $http, $q, $window, $timeout) {
	
	$scope.newRegulator = "";
	$scope.accountList = [];
	$scope.selectedAccount = "";
	$scope.regulatorIndicator = "";
	$scope.theRegulator = [];

	$window.onload = function() {
		initUtils(web3);
		var regulator = Regulator.deployed();
		$scope.regulatorIndicator = "";

    	web3.eth.getAccounts((e, accounts) => { 
    		if(accounts.length > 0) {
    			$scope.accountList = accounts;
    			$scope.selectedAccount = $scope.accountList[0];

				regulator.getRegulator({ from: $scope.selectedAccount }).then( function(regulatorAddress) { 	
					if(regulatorAddress != $scope.selectedAccount) throw Error("Not a Regulator");
					$timeout( function() {
						$scope.regulatorIndicator = "Regulator";
					});
				}).catch( function(e) {
					$timeout( function() {
						$scope.regulatorIndicator = "Not Regulator";
					});
					console.error(e);
				});
			} else {
				$timeout( function() {
					$scope.regulatorIndicator = "Address needed";
				});
			}
        });
	};

	$scope.onChangeAccount = function(selectedAccount) {
		initUtils(web3);
		setStatus("");
		var regulator = Regulator.deployed();
		$scope.regulatorIndicator = "";

		regulator.getRegulator({ from: $scope.selectedAccount }).then( function(regulatorAddress) { 	
			if(regulatorAddress != $scope.selectedAccount) throw Error("Not a Regulator");
			$timeout( function() {
				$scope.regulatorIndicator = "Regulator";
			});
		}).catch( function(e) {
			$timeout( function() {
				$scope.regulatorIndicator = "Not Regulator";
			});
			console.error(e);
		});
	}

	$scope.changeRegulator = function(newRegulator) {
		var regulator = Regulator.deployed();

		regulator.changeRegulator(newRegulator, { from: $scope.selectedAccount, gas: 3000000 }).then( function(txn) {
			return web3.eth.getTransactionReceiptMined(txn);
		}).then( function(receipt) {
			setStatus("New Regulator: " + newRegulator);
		}).catch( function(e) {
			setStatus("Action not allowed.")
			console.error(e);
		});
	};

	$scope.getRegulator = function() {
		var regulator = Regulator.deployed();
		$scope.theRegulator = [];

		/*
		** Set the header row into table
		*/
		$timeout(function() {
			$scope.theRegulator.push({
				regulator: "Regulator"
			});
		});

		regulator.getRegulator.call().then(function(address) {
			$timeout(function() {
				$scope.theRegulator.push({
					regulator: address
				});
			});
		}).catch(function(e) {
			setStatus("Something went wrong");
			console.error(e);
		})
	}
}]);