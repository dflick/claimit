

/*
** EXAMPLE:
**
** https://github.com/b9lab/nodejs-ethereum/tree/master/app
*/

const Web3 = require("web3");

if (typeof web3 !== 'undefined') {
	web3 = new Web3(web3.currentProvider); 
} else {
	web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}

const truffleContractFactory = require("truffle-contract");

const ClaimitJSON = require(__dirname + "/../contracts/Claimit.json");
const Claimit = truffleContractFactory(ClaimitJSON);

const DeviceRegistryJSON = require(__dirname + "/../contracts/DeviceRegistry.json");
const DeviceRegistry = truffleContractFactory(DeviceRegistryJSON);

const InsurerRegistryJSON = require(__dirname + "/../contracts/InsurerRegistry.json");
const InsurerRegistry = truffleContractFactory(InsurerRegistryJSON);

const InsurerJSON = require(__dirname + "/../contracts/Insurer.json");
const Insurer = truffleContractFactory(InsurerJSON);

const DeviceJSON = require(__dirname + "/../contracts/Device.json");
const Device = truffleContractFactory(DeviceJSON);

[Claimit, DeviceRegistry, InsurerRegistry, Insurer, Device].forEach(function(contract) {
	contract.setProvider(web3.currentProvider);
});

web3.eth.getAccountsPromise = function() {
    return new Promise(function (resolve, reject) {
        try {
            web3.eth.getAccounts(function (error, accounts) {
                if (error) {
                    reject(error);
                } else {
                    resolve(accounts);
                }
            });
        } catch(error) {
            reject(error);
        }
    });
};

Claimit.deployed().then(function(claimitInstance) {
	return claimitInstance.onDeviceClaim(
		{},
		{ fromBlock: "latest"}
	).watch( function(err, newEvent) {
		if(err) {
			console.error(err);
		} else {
			console.log(newEvent);
		}
	});
}).catch(function(e) {
	console.error(e);
});