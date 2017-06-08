var app = angular.module('insurerApp', []);

app.config(function ($locationProvider) {
	$locationProvider.html5Mode(true);
});

app.controller("insurerController", ['$scope', '$location', '$http', '$q', '$window', '$timeout', function($scope, $location, $http, $q, $window, $timeout){

	$scope.insurers = [];
	$scope.accountList = [];
	$scope.selectedAccount = "";
	$scope.regulatorIndicator = "";

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
						console.error(e);
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
	}

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
				console.error(e);
			});
		}).catch(function(e) {
			console.error(e);
		});
	};

	$scope.addNewInsurer = function(newAddress, newName, newBusinessID) {
		setStatus("");
		var claimit = "";

		Claimit.deployed().then(function(claimitInstance) {
			claimit = claimitInstance;
			return claimit.addInsurer(newAddress, newName, newBusinessID, { from: $scope.selectedAccount, gas: 500000 }).then( function(txnHash) {
				setStatus("New Insurer added: " + newName);
			}).catch( function(e) {
				setStatus("Adding Insurer failed.");
				console.error(e);
			});
		}).catch(function(e) {
			console.error(e);
		});
	}

	$scope.listInsurers = function() {
		setStatus("");
		var claimit = "";
		var insurerRegistry = "";
		$scope.insurerIndex = 0;
		$scope.insurers = [];

		// Set the header row into table

		$timeout( function() {
			$scope.insurers.push({
				insurerAddress: "Insurer address",
				insurerName: "Insurer name"
			});
		});

		Claimit.deployed().then(function(claimitInstance) {
			claimit = claimitInstance;
			return claimit.getInsurerRegistryInstance().then(function(insurerRegistryInstanceAddress) {
				return InsurerRegistry.at(insurerRegistryInstanceAddress).then(function(insurerRegistryInstance) {
					insurerRegistry = insurerRegistryInstance;
					return insurerRegistry.getInsurers().then(function(reg) {
						for(var i=0; i<reg.length; i++) {
							// this has to be let because var 
							// bleeds all over the place across { }
							let insurer = "";
							// this warns about not returning promise, but
							// if you return, loop will exit at first round
							Insurer.at(reg[i]).then(function(insurerInstance) {
								insurer = insurerInstance;
								return insurer.getAccount().then(function(acc) {
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
							}).catch(function(e) {
								console.error(e);
							});
						}
					}).catch(function(e) {
						console.error(e);
					});
				}).catch(function(e) {
					console.error(e);
				});
			}).catch(function(e) {
				console.error(e);
			});
		}).catch(function(e) {
			console.error(e);
		});
	}
}]);