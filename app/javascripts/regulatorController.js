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
		setStatus("");
		var regulator = "";
		$scope.regulatorIndicator = "";

    	web3.eth.getAccounts((e, accounts) => { 
    		if(accounts.length > 0) {
    			$scope.accountList = accounts;
    			$scope.selectedAccount = $scope.accountList[0];

    			Regulator.deployed().then(function(regulatorInstance) {
    				regulator = regulatorInstance;
					return regulator.getRegulator({ from: $scope.selectedAccount }).then( function(regulatorAddress) { 	
						if(regulatorAddress != $scope.selectedAccount) throw Error("Not a Regulator");
						$timeout( function() {
							$scope.regulatorIndicator = "Regulator";
						});
					}).catch( function(e) {
						$timeout( function() {
							$scope.regulatorIndicator = "Not Regulator";
						});
						// console.error(e);
					});
				}).catch(function(e) {
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
		var regulator = "";
		$scope.regulatorIndicator = "";

		Regulator.deployed().then(function(regulatorInstance) {
			regulator = regulatorInstance;
			return regulator.getRegulator({ from: $scope.selectedAccount }).then( function(regulatorAddress) { 	
				if(regulatorAddress != $scope.selectedAccount) throw Error("Not a Regulator");
				$timeout( function() {
					$scope.regulatorIndicator = "Regulator";
				});
			}).catch( function(e) {
				$timeout( function() {
					$scope.regulatorIndicator = "Not Regulator";
				});
				// console.error(e);
			});
		}).catch(function(e) {
			console.error(e);
		});
	}

	$scope.changeRegulator = function(newRegulator) {
		setStatus("");
		var regulator = "";
		
		Regulator.deployed().then(function(regulatorInstance) {
			regulator = regulatorInstance;
			setStatus("executing transaction...");
			return regulator.changeRegulator(newRegulator, { from: $scope.selectedAccount, gas: 3000000 }).then( function(txn) {
				setStatus("transaction validated");
				// works in truffle 3 while developing, but not in ropsten
				// if(txn.logs[0].type == "mined") setStatus("New Regulator: " + newRegulator);
				// else setStatus("Transaction was not mined in time limits");
			}).catch( function(e) {
				setStatus("Action not allowed.")
				// console.error(e);
			});
		}).catch(function(e) {
			console.error(e);
		});
	};

	$scope.getRegulator = function() {
		setStatus("");
		var regulator = "";
		$scope.theRegulator = [];

		/*
		** Set the header row into table
		*/
		$timeout(function() {
			$scope.theRegulator.push({
				regulator: "Regulator"
			});
		});

		Regulator.deployed().then(function(regulatorInstance) {
			regulator = regulatorInstance;
			return regulator.getRegulator.call().then(function(address) {
				$timeout(function() {
					$scope.theRegulator.push({
						regulator: address
					});
				});
			}).catch(function(e) {
				setStatus("Something went wrong");
				// console.error(e);
			});
		}).catch(function(e) {
			console.error(e);
		});
	}
}]);