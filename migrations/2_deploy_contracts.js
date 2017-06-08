var Device = artifacts.require("Device.sol");
var Insurer = artifacts.require("Insurer.sol");
var Regulator = artifacts.require("Regulator.sol");
var Admin = artifacts.require("Admin.sol");
var InsurerRegistry = artifacts.require("InsurerRegistry.sol");
var DeviceRegistry = artifacts.require("DeviceRegistry.sol");
var Claimit = artifacts.require("Claimit.sol");

module.exports = function(deployer) {
	deployer.deploy(Device);
	deployer.deploy(Insurer);
	deployer.deploy(Regulator).then(function(regulatorInstance) {
		return deployer.deploy(Admin).then(function(adminInstance) {
			return deployer.deploy(InsurerRegistry, Admin.address).then(function(insurerRegistryInstance) {
				return deployer.deploy(DeviceRegistry, Admin.address).then(function(deviceRegistryInstance) {
					return deployer.deploy(Claimit, Regulator.address, DeviceRegistry.address, InsurerRegistry.address).then(function(claimitInstance) {
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
};
