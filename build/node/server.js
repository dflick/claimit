

/*
** Prepares Web3 and File System.
*/

const Web3 = require("web3");
const Fs = require("fs");



/*
** Supports Mist, and other wallets that provide 'web3'.
*/



if (typeof web3 !== 'undefined') {
	// Use the Mist/wallet provider.
	Web3 = new Web3(web3.currentProvider);
} else {
	// Use the provider from config.
	web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}



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



const fileAbiMobileDevice = "./mobiledeviceabi.json";
const fileAddrMobileDevice = "./mobiledeviceaddr.json";
//const fileAbiInsurer = "./insurerabi.json";
//const fileAddrInsurer = "./insureraddr.json";



/*
** Promise to read a file
*/



function readFile(filename, encoding) {
	return new Promise(function (resolve, reject) {
		Fs.readFile(filename, encoding, function(err, res) {
			if(!err) resolve(res);
			else reject(err);
		});
	});
}



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



function readJSON(file) {
	return readFile(file, 'utf-8').then(function (res) {
		return JSON.parse(res);
	}).catch(function (err) {
		console.error(err);
	});
}



/*
** Function to instantiate MobileDevice contract
*/



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



web3.eth.getAccountsPromise()
    .then(function (accounts) {
    	console.log("");
    	console.log("Get accounts from Geth client");
        console.log(web3.eth.accounts);
        console.log("");
    })
    .catch(function (err) {
        console.error(err);
    });



/*
** Instantiate MobileDevice contract.
*/



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


const Http = require("http");
const Url = require("url");
const EthUtil = require("ethereumjs-util");



/*
** SOME ERROR RESPONES
*/



function serverError(response, err) {
    response.writeHeader(500, {"Content-Type": "text/plain"});
    response.write(err.toString());
    response.end();                    
}

function invalidMethod(response) {
    response.writeHeader(405);
    response.end();
}

function notFound(response, err) {
    response.writeHeader(404, {"Content-Type": "text/plain"});
    response.write(err.toString());
    response.end();
}

function badRequest(response, err) {
    response.writeHeader(400, {"Content-Type": "text/plain"});
    response.write(err.toString());
    response.end();
}



/*
** SERVER
**
** This is where we have to cheat a little bit, at least in Demo version.
** Url's that come through requests need to be in nice and readable form! 
** Meaning no spaces and things like that or no spaces and things like 
** that that are replaced by %20 and other markings. This is because
** we are not parsing anything here. 
**
** Although added later to decodeURIComponent(). Nothing more.
*/



Http.createServer(function(request, response) {
	var pathname = decodeURIComponent(Url.parse(request.url).pathname);
	console.log(pathname);



	/*
	** GET
	*/



	if(request.method == "GET") {
		if(pathname.startsWith("/tx/")) {
			var txHash = pathname.slice(4, 70);
			web3.eth.getTransaction(txHash, function(err, tx) {
				if(err) {
					serverError(response, err);
				} else if (tx == null) {
					notFound(response, txHash + " is not a known transaction");
				} else {
					response.writeHeader(200, {"Content-Type": "application/json)"});
					response.write(JSON.stringify(tx) + '\n');
					response.end();
				}
			});
		}  else {
			notFound(response, "");
		} 



	/*
	** END OF GET
	**
	** START OF PATCH
	*/



	} else if(request.method == "PATCH") {

		

		/*
		** addDevice
		*/



		if(pathname.startsWith("/addDevice/")) {



			/* 
			** function to call
			** addDevice(uint imei, uint owner, uint insured, bool trashed)
			**
			** HTTP request
			** curl -X PATCH http://localhost:8080/addDevice/1/imei/12345/owner/12345/insured/12345/trashed/false/endOf/
			*/



			/*
			** Get path indexes to know where input data starts and ends
			*/



			var xIndex = pathname.indexOf("/addDevice/"); // Geth account index
			var imeiIndex = pathname.indexOf("/imei/");
			var ownerIndex = pathname.indexOf("/owner/");
			var insuredIndex = pathname.indexOf("/insured/");
			var trashedIndex = pathname.indexOf("/trashed/");
			var endOfIndex = pathname.indexOf("/endOf/");



			/*
			** Slice up the pathname to get values
			*/



			var x = pathname.slice(xIndex + 11, imeiIndex);
			var imei = pathname.slice(imeiIndex + 6, ownerIndex);
			var owner = pathname.slice(ownerIndex + 7, insuredIndex);
			var insured = pathname.slice(insuredIndex + 9, trashedIndex);
			var trshed = pathname.slice(trashedIndex + 9, endOfIndex);



			/* 
			** Currently device is not trashed unless 
			** specifically told otherwise ("/trashed/" = true)
			*/



			var trashed = new Boolean(false);
			trashed = Boolean(trshed == "true");



			/*
			** Get accounts. Utilised account should come from
			** file in future. If so happens that there
			** would be multiple accounts on Geth like
			** I have in testing it might be confusing
			** on the long run which account to use.
			*/



			var accounts = web3.eth.getAccountsPromise().then(function (accounts) {
				var account = accounts[x]; // account index is parsed from html



					/*
					** Instantiate MobileDevice
					*/



					instantiateMobileDevice().then(MobileDevice => {


					/*
					** Check that the account/address exists on a contract
					*/


					// This returns true even if insurer exists is false?
					// Utilises account 0x914d5475cc8df77055fb8f21d822b4b8663a6f13
					// from Geth. See server.js rows 165 and 166

					console.log("Insurer we are looking for is: " + account);

					var exists = MobileDevice.insurerExists.call(account);

					console.log("Insurer exists: " + exists);

					if(exists) {

						console.log("Insurer exists was true with value: " + exists);



							/*
							** addDevice(uint imei, uint owner, uint insured, bool trashed)
							**
							** If an account that does not exist on Geth client but exists
							** on a Insurer contract tries to execute a transaction addDevice
							** I am not able to cactch and handle the issue so that client
							** does not freeze. Although I am not sure if it matters.
							*/



							var txHash = MobileDevice.addDevice(imei, owner, insured, trashed, { from: account, gas: 3000000 });
							
							response.writeHeader(200, {"Content-Type": "application/json)"});
							response.write(JSON.stringify({ transactionHash: txHash }) + '\n');
							response.end();

					// Insurer did not exist
					} else {
							response.writeHeader(200, {"Content-Type": "application/json)"});
							response.write(JSON.stringify({ insurerExists: exists }) + '\n');
							response.end();
					}

				// instantiateMobileDevice()
				}).catch(function(err) {
					console.error(err);
				});

			// web3.eth.getAccountsPromise()
			}).catch(function (err) {
				console.error(err);
			});



		/*
		** END OF addDevice
		*/



		} else if(pathname.startsWith("/addDeviceHistory/")) {



			/* 
			** function to call
			** addDeviceHistory(uint imei, uint insured, string issue, string resolution, uint partner)
			**
			** HTTP request
			** curl -X PATCH http://localhost:8080/addDeviceHistory/imei/12345/insured/1/issue/always%20so%20damn%20broken/resolution/fixed%20even%20always%20broken/partner/1/endOf/
			*/



			/*
			** Get path indexes to know where input data starts and ends
			*/



			var imeiIndex = pathname.indexOf("/imei/");
			var insuredIndex = pathname.indexOf("/insured/");
			var issueIndex = pathname.indexOf("/issue/");
			var resolutionIndex = pathname.indexOf("/resolution/");
			var partnerIndex = pathname.indexOf("/partner/");
			var endOfIndex = pathname.indexOf("/endOf/");



			/*
			** Slice up the pathname to get values
			*/



			var imei = pathname.slice(imeiIndex + 6, insuredIndex);
			var insured = pathname.slice(insuredIndex + 9, issueIndex);
			var issue = pathname.slice(issueIndex + 7, resolutionIndex);
			var resolution = pathname.slice(resolutionIndex + 12, partnerIndex);
			var partner = pathname.slice(partnerIndex + 9, endOfIndex)



			/*
			** Get accounts. I account should come from
			** file in future. If so happens that there
			** would be multiple accounts on Geth like
			** I have in testing it might be confusing
			** on the long run which account to use.
			*/



			var accounts = web3.eth.getAccountsPromise().then(function (accounts) {
				var account = accounts[1]; // this should not be hardcoded in reality



				/*
				** Instantiate MobileDevice
				*/ 



				instantiateMobileDevice().then(MobileDevice => { 



					/*
					** Check that the account/address exists on a contract
					*/



					var exists = MobileDevice.insurerExists.call(account);

					if(exists) {



						/*
						** addDeviceHistory(uint imei, uint insured, string issue, string resolution, uint partner)
						**
						** If an account that does not exist on Geth client but exists
						** on a Insurer contract tries to execute a transaction addDevice
						** I am not able to cactch and handle the issue so that client
						** does not freeze. Although I am not sure if it matters, because
						** if someone wants to send malicious transaction to contract
						** we don't care if weird things happens to them.
						*/



						var txHash = MobileDevice.addDeviceHistory(imei, insured, issue, resolution, partner, { from: account, gas: 3000000 });
						
						response.writeHeader(200, {"Content-Type": "application/json)"});
						response.write(JSON.stringify({ transactionHash: txHash }) + '\n');
						response.end();

					// Insurer did not exist
					} else {
							response.writeHeader(200, {"Content-Type": "application/json)"});
							response.write(JSON.stringify({ insurerExists: exists }) + '\n');
							response.end();
					}

				// instantiateMobileDevice()
				}).catch(function(err) {
					console.error(err);
				});

			// web3.eth.getAccountsPromise()
			}).catch(function (err) {
				console.error(err);
			});



		/*
		** END OF addDeviceHistory
		*/



		}



	/*
	** END OF PATCH
	*/



	} else {
		invalidMethod(response);
	}
}).listen(8080);
