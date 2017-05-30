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
	Regulator private regulator;
	DeviceRegistry private deviceRegistry;
	InsurerRegistry private insurerRegistry;

	modifier isInsurer()
	{
		if(!InsurerRegistry(insurerRegistry).isInsurer()) throw;
		_;
	}

	function DeviceController(address regulatorInstanceAddress, address deviceRegistryAddress, address insurerRegistryAddress) 
	{
		controller = this;
		regulator = Regulator(regulatorInstanceAddress);
		deviceRegistry = DeviceRegistry(deviceRegistryAddress);
		insurerRegistry = InsurerRegistry(insurerRegistryAddress);

		deviceRegistry.setController();
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
		// check if device exists in registry
		if(deviceRegistry.getDevice(imei) != 0x0) return false;

		// device does not exist in registry

		Device d = new Device(imei);
		deviceRegistry.addDevice(imei, d);
		return true;
	}

	function setControllerToDeviceRegistry()
		isAdmin
	{
		deviceRegistry.setController();
	}
}