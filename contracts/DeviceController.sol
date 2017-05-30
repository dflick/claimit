pragma solidity ^0.4.5;

import "Admin.sol";
import "Regulator.sol";
import "DeviceRegistry.sol";
import "InsurerRegistry.sol";
import "Insurer.sol";
import "Device.sol";

contract DeviceController is Admin
{
	address private controller;
	address private regulator;
	address private deviceRegistry;
	address private insurerRegistry;

	modifier isInsurer()
	{
		if(!InsurerRegistry(insurerRegistry).isInsurer()) throw;
		_;
	}

	function DeviceController(address regulatorInstanceAddress, address deviceRegistryAddress, address insurerRegistryAddress) 
	{
		controller = this;
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

	function getControllerInstance()
		constant
		returns(address)
	{
		return controller;
	}

	function addDevice(string imei)
		isInsurer
		returns(bool)
	{	
		// check if defice in registry

		// if device not in registry create new Device
		// if device not in registry add device to registry
	}
}