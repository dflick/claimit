pragma solidity ^0.4.5;

import "Regulator.sol";
import "DeviceRegistry.sol";
import "InsurerRegistry.sol";
import "Insurer.sol";
import "Device.sol";

contract DeviceController
{
	Regulator private regulator;
	DeviceRegistry private deviceRegistry;
	InsurerRegistry private insurerRegistry;

	modifier isRegulator()
	{
		if(regulator.getRegulator() != msg.sender) throw;
		_;
	}

	modifier isInsurer()
	{
		if(insurerRegistry.getInsurer(msg.sender) == 0x0) throw;
		_;
	}

	function DeviceController(address regulatorInstanceAddress, address deviceRegistryAddress, address insurerRegistryAddress) 
	{
		regulator = Regulator(regulatorInstanceAddress);
		deviceRegistry = DeviceRegistry(deviceRegistryAddress);
		insurerRegistry = InsurerRegistry(insurerRegistryAddress);

		deviceRegistry.setController();
		insurerRegistry.setController();
	}

	function addInsurer(address insurerAddress, string insurerName, string insurerBusinessID)
		isRegulator
		returns(bool)
	{
		// check if insurer exists in registry
		if(insurerRegistry.getInsurer(insurerAddress) != 0x0) return false;

		// insurer does not exist in registry
		Insurer i = new Insurer(insurerAddress, insurerName, insurerBusinessID);
		insurerRegistry.addInsurer(insurerAddress, i);
		return true;
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
		return this;
	}
}