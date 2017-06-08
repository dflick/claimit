var Migrations = artifacts.require("Migrations.sol");

Migrations.setProvider(web3.currentProvider);

module.exports = function(deployer) {
  deployer.deploy(Migrations);
};
