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
