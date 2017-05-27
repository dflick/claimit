var app = angular.module('insuranceApp', []);

app.config(function ($locationProvider) {
	$locationProvider.html5Mode(true);
});

app.controller("insuranceController", ['$scope', '$location', '$http', '$q', '$window', '$timeout', function($scope, $location, $http, $q, $window, $timeout) {
	
	$scope.curRegulator = "";

	$window.onload = function() {

		// this is important for
		// getTransactionReceiptMined to work
		initUtils(web3);

		var regulator = Regulator.deployed();

    	web3.eth.getAccounts((e, accounts) => { 

    		if(accounts.length > 0) 
    		{
	    		var account = accounts[0]; 

				$timeout( function() 
				{
					regulator.getRegulator.call({ from: account })
						.then( function(regulatorAddress) 
						{ 	
							if(regulatorAddress != account) throw Error("Not a Regulator");

							$timeout( function()
							{
								$scope.curRegulator = regulatorAddress;
							});
						})
						.catch( function(e) 
						{
							$timeout( function()
							{
								$scope.curRegulator = "Not a Regulator";
							});

							console.error(e);
						});
				});

			} else 
			{
				$timeout( function() 
				{
					$scope.curRegulator = "Address needed";
				});
			}
        });
		
	}

	$scope.addNewInsurance = function(newName, newDescription) {

		var insurance = Insurance.deployed();

		// REMEMBER: Any calls that change the state of the contract require a signed transaction. 
		// Error: invalid address, might be due to lack of account in transaction. Although not sure.
		insurance.addInsurance(newName, newDescription, { from: $scope.curRegulator, gas: 3000000 })
			.then( function(txnHash) {
				// Make sure you have initialized utilities initUtils(web3); in $window.onload function
				return web3.eth.getTransactionReceiptMined(txnHash)
					.then(function (receipt) 
					{
						setStatus("New insurance added: " + newName);
					})
					.catch(function (e) {
						setStatus("Transaction failed.");
						console.error("Transaction failed: " + e);
					});
			})
			.catch( function(e) {
				setStatus("Adding insurance failed");
				console.error("Adding insurance failed: " + e);
			});
		// Cannot use this because I am not able to catch error when 
		// cancelling transactions before it happens in Mist window.
		// setStatus("Adding a new insurance... please wait...")
	}

	$scope.insurances = [];
	
	$scope.listInsurances = function() {

		var insurance = Insurance.deployed();
		$scope.insuranceIndex = 0;
		$scope.insurances = [];

		insurance.getNextInsuranceId.call()
			.then( function(nextId) {
				
				for (var i = 1; i < nextId; i++) {
					$scope.insuranceIndex++; // my ids in contract Insurance start from 1

					insurance.getInsurance.call($scope.insuranceIndex)
						.then( function(values) {

							console.log(values);
							
							$timeout( function() {
								$scope.insurances.push({
									insuranceId: values[0],
									insuranceName: values[1],
									insuranceDescription: values[2]
								});

							});

						})
						.catch( function(e) {
							console.error(e);
						});

				}

				return $scope.insurances;
			})
			.catch( function(e) {
				console.error(e);
			});
	}

}]);