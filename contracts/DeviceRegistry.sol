pragma solidity ^0.4.5;

import "Mortal.sol";
import "Device.sol";
import "InsurerRegistry.sol";

contract DeviceRegistry is Mortal
{
	address[] private devices;
	// imei => Device instance address
	mapping(string => address) deviceInstances;
	InsurerRegistry private ir;

	modifier isInsurer()
	{
		if(!ir.isInsurer()) throw;
		_;
	}

	function DeviceRegistry(address insurerRegistryInstanceAddress)
	{

		ir = InsurerRegistry(insurerRegistryInstanceAddress);
	}

	function addDevice(string imei) 
		isInsurer
		returns(bool successful)
	{
		successful = false;
		if(deviceInstances[imei] != 0x0) return successful;

		Device d = new Device(imei);
		devices.push(d);
		deviceInstances[imei] = d;
		successful = true;
		return successful;
	}

	function getDevice(string imei)
		constant
		returns(address)
	{
		return deviceInstances[imei];
	}

	function getDevices()
		constant
		returns(address[])
	{
		return devices;
	}
}