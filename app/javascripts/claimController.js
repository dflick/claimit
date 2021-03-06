var app = angular.module('claimitApp', []);

app.config(function($locationProvider) {
	$locationProvider.html5Mode(true);
});

app.controller("claimController",  ['$scope', '$location', '$http', '$q', '$window', '$timeout', function($scope, $location, $http, $q, $window, $timeout) {

	$scope.curInsurer = "";
	$scope.curInsurerInstance = "";
	$scope.mobileClaims = [];
	$scope.deviceEvents = "";
	$scope.accountList = [];
	$scope.selectedAccount = "";
	$scope.selectedAccountData = [];

	$window.onload = function() {
		setStatus("");
		initUtils(web3);
		$scope.curInsurer = "";
		$scope.curInsurerInstance = "";
		var insurerRegistry = "";
		var claimit = "";

    	web3.eth.getAccounts((e, accounts) => { 
    		if(accounts.length > 0) {
    			$timeout(function(){
		   			$scope.accountList = accounts;
		   			$scope.selectedAccount = $scope.accountList[0];
		   			return Claimit.deployed().then(function(claimitInstance) {
		   				claimit = claimitInstance;
		   				return claimit.getInsurerRegistryInstance().then(function(insurerRegistryInstanceAddress) {
		   					return InsurerRegistry.at(insurerRegistryInstanceAddress).then(function(insurerRegistryInstance) {
								insurerRegistry = insurerRegistryInstance;
								insurerRegistry.getInsurer($scope.selectedAccount).then(function(instanceAddr) {
									if(instanceAddr == 0x0) {
										console.log("not insurer");
										return;
									}
									$timeout( function() {
										$scope.curInsurer = $scope.selectedAccount;
										$scope.curInsurerInstance = instanceAddr;
										return $scope.getInsurer();
									});
								}).catch( function(e) {
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
				});
			} else {
				throw Error("No account");
			}
			return accounts;
        });
	}

	$scope.onChangeAccount = function(selectedAccount) {
		setStatus("");
		initUtils(web3);
		$scope.curInsurer = "";
		$scope.curInsurerInstance = "";
		var insurerRegistry = "";
		var claimit = "";

		Claimit.deployed().then(function(claimitInstance) {
			claimit = claimitInstance;
			return claimit.getInsurerRegistryInstance().then(function(insurerRegistryInstanceAddress) {
				return InsurerRegistry.at(insurerRegistryInstanceAddress).then(function(insurerRegistryInstance) {
					insurerRegistry = insurerRegistryInstance;
					return insurerRegistry.getInsurer($scope.selectedAccount).then( function(instanceAddr) {
						if(instanceAddr == 0x0) {
							console.log("not insurer");
							return; 
						}
						$timeout( function() {
							$scope.curInsurer = $scope.selectedAccount;
							$scope.curInsurerInstance = instanceAddr;
							return $scope.getInsurer();
						});
					}).catch( function(e) {
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
	};

	$scope.getInsurer = function() {
		var insurer = "";
		$scope.selectedAccountData = [];

		Insurer.at($scope.curInsurerInstance).then(function(insurerInstance) {
			insurer = insurerInstance;
			return insurer.getAccount().then(function(account) {
				return insurer.getName().then(function(name) {
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
			}).catch(function(e) {
				console.error(e);
			});
			return $scope.selectedAccountData;
		}).catch(function(e) {
			console.error(e);
		});
	}
	
	$scope.addDevice = function(imei, deviceLost, deviceStolen, deviceBroke, deviceScrap) {
		setStatus("");

		var claimit = "";

		var lost = "";
		if(deviceLost != true) lost = false;
		else lost = deviceLost;

		var stolen = "";
		if(deviceStolen != true) stolen = false;
		else stolen = deviceStolen;		

		var broke = "";
		if(deviceBroke != true) broke = false;
		else broke = deviceBroke;

		var scrap = "";
		if(deviceScrap != true) scrap = false;
		else scrap = deviceScrap;

		// NOTE TO ME: At this point. If you add a device that exists, transaction dialog in Mist
		// will inform you that you will run out of gas. So, very misleading which means that I
		// have to remember in future when error/warning appears that this is the reason. Until
		// I want to fix it.

		// NOTE TO ME: Any calls that change the state of the contract require a signed transaction. 
		// Error: invalid address, might be due to lack of account in transaction. Although not sure.
		Claimit.deployed().then(function(claimitInstance) {
			claimit = claimitInstance;
			setStatus("executing transaction...");
			return claimit.addDeviceClaim(imei, lost, stolen, broke, scrap, { from: $scope.curInsurer, gas: 3000000}).then(function(txnHash) {
					// Make sure you have initialized utilities initUtils(web3); in $window.onload function
					setStatus("transaction validated");
					console.log(txnHash);
			}).catch(function (e) {
				setStatus("Error while adding claim");
				console.error("Error while adding claim: " + e);
			});
		}).catch(function(e) {
			console.error(e);
		});
	}

	$scope.findDevice = function(imei) {
		var deviceRegistry = "";
		var claimit = "";
		$scope.mobileClaims = [];
		setStatus("");

		/*
		** Set the header row into table
		*/
		$timeout(function() {
			$scope.mobileClaims.push({
				imei: "Imei",
				lost: "Lost",
				stolen: "Stolen",
				broke: "Broken",
				scrap: "Scrapped"
			});
		});

		Claimit.deployed().then(function(claimitInstance) {
			claimit = claimitInstance;
			claimit.getDeviceRegistryInstance().then(function(deviceRegistryInstanceAddress) {
				DeviceRegistry.at(deviceRegistryInstanceAddress).then(function(deviceRegistryInstance) {
					deviceRegistry = deviceRegistryInstance;

					deviceRegistry.getDevice(imei).then(function(deviceAddr) {

						if(deviceAddr == 0x0) {
							console.log("no device " + imei);
							setStatus("no device " + imei);
							return;
						}

						let device = Device.at(deviceAddr);

						return device.getLost().then(function(lostIndicator) {
							return device.getStolen().then(function(stolenIndicator) {
								return device.getBroke().then(function(brokeIndicator) {
									return device.getScrap().then(function(scrapIndicator) {
										$timeout(function() {
											$scope.mobileClaims.push({
												imei: imei,
												lost: lostIndicator,
												stolen: stolenIndicator,
												broke: brokeIndicator,
												scrap: scrapIndicator
											});
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
		}).catch(function(e) {
			console.error(e);
		});
	}

	$scope.listDevices = function() {
		var deviceRegistry = "";
		var claimit = "";
		$scope.mobileClaims = [];
		setStatus("");

		/*
		** Set the header row into table
		*/
		$timeout(function() {
			$scope.mobileClaims.push({
				imei: "Imei",
				lost: "Lost",
				stolen: "Stolen",
				broke: "Broken",
				scrap: "Scrapped"
			});
		});

		Claimit.deployed().then(function(claimitInstance) {
			claimit = claimitInstance;
			claimit.getDeviceRegistryInstance().then(function(deviceRegistryInstanceAddress) {
				DeviceRegistry.at(deviceRegistryInstanceAddress).then(function(deviceRegistryInstance) {
					deviceRegistry = deviceRegistryInstance;
					deviceRegistry.getDevices().then(function(devices) {
						console.log(devices.length);

						for(var i=0; i<devices.length; i++) {
							console.log(devices[i]);
							const device = Device.at(devices[i]);

							device.getImei().then(function(imei) {
								return device.getLost().then(function(lostIndicator) {
									return device.getStolen().then(function(stolenIndicator) {
										return device.getBroke().then(function(brokeIndicator) {
											return device.getScrap().then(function(scrapIndicator) {
												$timeout(function() {
													$scope.mobileClaims.push({
														imei: imei,
														lost: lostIndicator,
														stolen: stolenIndicator,
														broke: brokeIndicator,
														scrap: scrapIndicator
													});
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
								}).catch(function(e) {
									console.error(e);
								});
							}).catch(function(e) {
								console.error(e);
							});
						}

						return $scope.mobileClaims;

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