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