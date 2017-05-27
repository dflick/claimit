module.exports = function(deployer) {
  	deployer.deploy(MobileController);
  	deployer.deploy(Regulator);
  	deployer.deploy(Insurer);
};