pragma solidity ^0.4.5;

import "Regulator.sol";
import "DeviceRegistry.sol";
import "InsurerRegistry.sol";
import "Insurer.sol";
import "Device.sol";

contract Claimit
{
	Regulator private regulator;
	DeviceRegistry private deviceRegistry;
	InsurerRegistry private insurerRegistry;

	event onDeviceClaim(uint _timestamp, address _insurer, string _imei, string _claimreason);

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

	function Claimit(address regulatorInstanceAddress, address deviceRegistryAddress, address insurerRegistryAddress) 
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

	function addDeviceClaim(string imei, bool lost, bool stolen, bool broke, bool scrap)
		isInsurer
		returns(uint) // 1, new device; 2, existing device; 3, something else
	{	
		address imeiAddress = deviceRegistry.getDevice(imei);
		Device d;

		if(imeiAddress == 0x0)
		{
			// Add new device and claim reason
			d = new Device(imei, lost, stolen, broke, scrap);
			deviceRegistry.addDevice(imei, d);

			if(lost) onDeviceClaim(now, msg.sender, imei, "lost");
			if(stolen) onDeviceClaim(now, msg.sender, imei, "stolen");
			if(broke) onDeviceClaim(now, msg.sender, imei, "broke");
			if(scrap) onDeviceClaim(now, msg.sender, imei, "scrap");

			return 1;
		}
		else
		{
			// Add claim reason to existing device
			d = Device(imeiAddress);

			if(lost) 
			{
				d.setLost(lost);
				onDeviceClaim(now, msg.sender, imei, "lost");
			}
			if(stolen)
			{
				d.setStolen(stolen);
				onDeviceClaim(now, msg.sender, imei, "stolen");
			}
			if(broke)
			{
				d.setBroke(broke);
				onDeviceClaim(now, msg.sender, imei, "broke");
			}
			if(scrap)
			{
				d.setScrap(scrap);
				onDeviceClaim(now, msg.sender, imei, "broke");
			}

			return 2;
		}
		return 3;
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