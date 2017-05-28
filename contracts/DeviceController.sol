pragma solidity ^0.4.5;

import "Admin.sol";
import "Regulator.sol";
import "DeviceRegistry.sol";
import "InsurerRegistry.sol";
import "Insurer.sol";
import "Device.sol";

contract DeviceController is Admin
{
	address private regulator;
	address private deviceRegistry;
	address private insurerRegistry;

	event onAddDeviceClaim(string _imei, bool _lost, bool _stolen, bool _broke, bool scrap);

	function DeviceController(address regulatorInstanceAddress, address deviceRegistryAddress, address insurerRegistryAddress) 
	{
		regulator = regulatorInstanceAddress;
		deviceRegistry = deviceRegistryAddress;
		insurerRegistry = insurerRegistryAddress;
	}

	function getInsurerRegistryInstance()
		constant
		returns(address)
	{
		return insurerRegistry;
	}

	function getDeviceRegistryInstance()
		constant
		returns(address)
	{
		return deviceRegistry;
	}

	function getRegulatorInstance()
		constant
		returns(address)
	{
		return regulator;
	}

	function addDeviceClaim(string imei, bool deviceLost, bool deviceStolen, bool deviceBroken, bool deviceScrapped)
	{
		// update device device status, only insurer can do that
		// do we care if device status is already true?
		// trigger an event

	}
}