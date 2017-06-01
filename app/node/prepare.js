const Web3 = require("web3");

const Claimit = require(__dirname + "/../contracts/Claimit.sol.js");
const DeviceRegistry = require(__dirname + "/../contracts/DeviceRegistry.sol.js");
const InsurerRegistry = require(__dirname + "/../contracts/InsurerRegistry.sol.js");
const Insurer = require(__dirname + "/../contracts/Insurer.sol.js");
const Device = require(__dirname + "/../contracts/Device.sol.js");

if (typeof web3 !== 'undefined') {
	Web3 = new Web3(web3.currentProvider); 
} else {
	web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}

[Claimit, DeviceRegistry, InsurerRegistry, Insurer, Device].forEach(function(contract) {
	contract.setProvider(web3.currentProvider);
});

console.log("prepared");

/*
** Prepares Web3 and File System.
*/

//const Web3 = require("web3");
//const Fs = require("fs");



/*
** Supports Mist, and other wallets that provide 'web3'.
*/


/*
if (typeof web3 !== 'undefined') {
	// Use the Mist/wallet provider.
	Web3 = new Web3(web3.currentProvider);
} else {
	// Use the provider from config.
	web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}
*/



/*
** In development copy ABI and Address contents from contract.sol.js 
** file and place them into respective *abi.json and *addr.json files.
** Meaning MobileDevice.sol.js files abi content into mobiledeviceabi.json
** file and MobileDevice.sol.js files address into mobiledeviceaddr.json
** file and so on. One abi and address per contract.
**
** #1 REMEMBER in reality these files need to be transferred
** automatically to a place where they are reached "near" real 
** time for Party nodejs purposes. Party nodejs means web server
** that is dedicated to Insurer or Insurer Partner. Party server
** needs a Geth client and Nodejs server to run.
** 
** #2 REMEMBER to make sure you got last versions of ABI and 
** Address when preparing and running server. Otherwise
** you will get TypeError while calling instantiateMobileDevice() 
**
** TypeError: Cannot read property 'call' of undefined
** (altough there might be other reasons for this error also...)
**
** #3 REMEMBER to run init_content scripts in truffle or make sure
** that there is test data in test_rpc or test network for results.
*/



//const fileAbiMobileDevice = "./mobiledeviceabi.json";
//const fileAddrMobileDevice = "./mobiledeviceaddr.json";
//const fileAbiInsurer = "./insurerabi.json";
//const fileAddrInsurer = "./insureraddr.json";



/*
** Promise to read a file
*/


/*
function readFile(filename, encoding) {
	return new Promise(function (resolve, reject) {
		Fs.readFile(filename, encoding, function(err, res) {
			if(!err) resolve(res);
			else reject(err);
		});
	});
}
*/


/*
** Promise to get accounts
*/



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



/*
** Parse JSON from file
*/


/*
function readJSON(file) {
	return readFile(file, 'utf-8').then(function (res) {
		return JSON.parse(res);
	}).catch(function (err) {
		console.error(err);
	});
}
*/



/*
** Function to instantiate MobileDevice contract
*/


/*
function instantiateMobileDevice() {
	return readJSON(fileAbiMobileDevice).then(function (abi) {
		return web3.eth.contract(abi);
	}).then(function (mobileDeviceApi) {
		return readJSON(fileAddrMobileDevice).then(function (addr) {
			return mobileDeviceApi.at(addr.addr);
		}).then(function (MobileDevice) {
			return MobileDevice;
		}).catch(function(err) {
			console.error(err);
		});
	}).catch(function (err) {
		console.error(err);
	});
}
*/



/*
** These calls are only for testing purposes in here.
** Put these into server.js to make things nicer.
** And delete this when sure enough that stuff works.
** This is just fast way of testing that contract 
** initilaization works.
*/



/*
** Get accounts on client.
*/


/*
web3.eth.getAccountsPromise()
    .then(function (accounts) {
    	console.log("");
    	console.log("Get accounts from Geth client");
        console.log(accounts);
        console.log("");
    })
    .catch(function (err) {
        console.error(err);
    });

*/

/*
** Instantiate MobileDevice contract.
*/


/*
instantiateMobileDevice().then(MobileDevice => {
	console.log("************************************************");
	console.log("*                                              *");
	console.log("*              Making preparations             *");
	console.log("*                                              *");
	console.log("************************************************");
	console.log("")
	console.log("Ask if two different Insurer accounts exists on contract");
	console.log("Insurer 0x914d5475cc8df77055fb8f21d822b4b8663a6f13");
	console.log("exists: " + MobileDevice.insurerExists.call("0x914d5475cc8df77055fb8f21d822b4b8663a6f13"));
	console.log("Insurer 0xde00963c3de0f8be755ef3cde96ecfad55e6f245");
	console.log("exists: " + MobileDevice.insurerExists.call("0xde00963c3de0f8be755ef3cde96ecfad55e6f245"));
	console.log("");
	console.log("Mobile devices from indexes");
	console.log("index 0: " + MobileDevice.getDeviceX.call(0));
	console.log("index 1: " + MobileDevice.getDeviceX.call(1));
	console.log("index 2: " + MobileDevice.getDeviceX.call(2));
	console.log("index 3: " + MobileDevice.getDeviceX.call(3));
	console.log("");
	console.log("************************************************");
	console.log("*                                              *");
	console.log("*      Preparations done. Have a nice day.     *");
	console.log("*                                              *");
	console.log("************************************************");
	console.log("");
}).catch(function(err) {
	console.error(err);
});
*/