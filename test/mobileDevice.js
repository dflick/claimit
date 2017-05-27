contract('MobileDevice', function(accounts) {

	it("should be possible to add new device '12345'", function() {
		var device = MobileDevice.deployed();
		return device.addDevice.call(12345, 1, 1)
			.then(function (successful) {
				assert.isTrue(successful, "should be able to add device");
				return device.addDevice(12345, 1, 1);
			});
	});

	/* JUST AN EXAMPLE TO LISTEN TO EVENTS
	** var depositEventAll = cryptoExContract.Deposit({_sender: userAddress}, {fromBlock: 0, toBlock: 'latest'});
	** depositEventAll.watch(function(err, result) {
  	** 		if (err) {
    **			console.log(err)
    ** 			return;
  	** 		}
	** })
	*/

	// 	event OnAddDevice(uint _imei, uint _deviceOwner, uint _insuranceOwner);
	/*
	it("should be possible to listen events like add device", function() {
		var device = MobileDevice.deployed();
		return device.OnAddDevice({ _imei: 12345 })
			.then(function (event) {
				event.watch(function(err, result) {
					if(err)
					{
						console.log(err);
					}
					console.log(event.args._imei);
					return event.args;
				});
			});
	});
	*/

}); 