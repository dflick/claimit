Claimit.deployed().onDeviceClaim(
	{},
	{ fromBlock: "latest"}
).watch( function(err, newEvent) {
	if(err) {
		console.error(err);
	} else {
		console.log(newEvent);
	}
});