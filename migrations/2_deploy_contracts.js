module.exports = function(deployer) {
	deployer.deploy(Device);
	deployer.deploy(Insurer);
	deployer.deploy(Admin).then(function() {
		return deployer.deploy(Regulator, Admin.address).then(function() {
			return deployer.deploy(InsurerRegistry, Regulator.address).then(function() {
				return deployer.deploy(DeviceRegistry, Admin.address).then(function() {
					return deployer.deploy(DeviceController, Regulator.address, DeviceRegistry.address, InsurerRegistry.address);
				});
			});
		});
	});
};