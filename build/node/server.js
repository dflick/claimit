

/*
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



		if(pathname.startsWith("/addDeviceClaim/")) {



			/* 
			** function to call
			** addDevice(uint imei, uint owner, uint insured, bool trashed)
			**
			** HTTP request
			** curl -X PATCH http://localhost:8080/addDeviceClaim/1/imei/12345/lost/true/stolen/false/broke/false/scrap/false/endOf/
			*/



			/*
			** Get path indexes to know where input data starts and ends
			*/



			var xIndex = pathname.indexOf("/addDeviceClaim/"); // Geth account index
			var imeiIndex = pathname.indexOf("/imei/");
			var lostIndex = pathname.indexOf("/lost/");
			var stolenIndex = pathname.indexOf("/stolen/");
			var brokeIndex = pathname.indexOf("/broke/");
			var scrapIndex = pathname.indexOf("/scrap/");
			var endOfIndex = pathname.indexOf("/endOf/");



			/*
			** Slice up the pathname to get values
			*/



			var x = pathname.slice(xIndex + 16, imeiIndex);
			var imei = pathname.slice(imeiIndex + 6, lostIndex);
			var islost = pathname.slice(lostIndex + 6, stolenIndex);
			var isstolen = pathname.slice(stolenIndex + 8, brokeIndex);
			var isbroke = pathname.slice(brokeIndex + 7, scrapIndex);
			var isscrap = pathname.slice(scrapIndex + 7, endOfIndex);



			/* 
			** Currently device is not trashed unless 
			** specifically told otherwise ("/trashed/" = true)
			*/



			var lost = new Boolean(false);
			lost = Boolean(islost == "true");

			var stolen = new Boolean(false);
			stolen = Boolean(isstolen == "true");

			var broke = new Boolean(false);
			broke = Boolean(isbroke == "true");

			var scrap = new Boolean(false);
			scrap = Boolean(isscrap == "true");



			/*
			** Get accounts. Utilised account should come from
			** file in future. If so happens that there
			** would be multiple accounts on Geth like
			** I have in testing it might be confusing
			** on the long run which account to use.
			*/



			var accounts = web3.eth.getAccountsPromise().then(function (accounts) {
				var account = accounts[x]; // account index is parsed from html

				console.log("");
				console.log("chosen account");
				console.log(account);
				console.log("imei");
				console.log(imei);
				console.log("lost");
				console.log(lost);
				console.log("stolen");
				console.log(stolen);
				console.log("broke");
				console.log(broke);
				console.log("scrap");
				console.log(scrap);
				console.log("");

				var claimit = "";
				Claimit.deployed().then(function(claimitInstance) {
					claimit = claimitInstance;
					claimit.addDeviceClaim(imei, lost, stolen, broke, scrap, {from: account, gas: 3000000 }).then(txnHash => {

								
						response.writeHeader(200, {"Content-Type": "application/json)"});
						response.write(JSON.stringify({ transactionHash: txnHash }) + '\n');
						response.end();

					}).catch(function(err) {
						console.error(err);
					});
				}).catch(function(e) {
					console.error(e);
				});
			}).catch(function (err) {
				console.error(err);
			});



		/*
		** END OF addDevice
		*/



		}



	/*
	** END OF PATCH
	*/



	} else {
		invalidMethod(response);
	}
}).listen(8080);
