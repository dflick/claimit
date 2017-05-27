/*
** Instantiate MobileDevice and start event listener
** for OnAddDevice()
*/



instantiateMobileDevice().then(MobileDevice => {
	MobileDevice.OnAddDevice(
		{},
		{ fromBlock: "latest"}
	).watch( function(err, newEvent) {
		if(err) {
			console.error(err);
		} else {
			console.log(newEvent);
		}
	});
});



/*
** Instantiate MobileDevice and start event listener
** for OnAddDeviceHistory()
*/



instantiateMobileDevice().then(MobileDevice => {
	MobileDevice.OnAddDeviceHistory(
		{},
		{ fromBlock: "latest"}
	).watch( function(err, newEvent) {
		if(err) {
			console.error(err);
		} else {
			console.log(newEvent);
		}
	});
});