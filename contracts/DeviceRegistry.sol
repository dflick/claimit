pragma solidity ^0.4.5;

import "Admin.sol";
import "Mortal.sol";
import "Device.sol";
import "InsurerRegistry.sol";

contract DeviceRegistry is Mortal
{
	Admin private admin;
	address private controller;

	address[] private devices;
	// imei => Device instance address
	mapping(string => address) deviceInstances;

	modifier isController()
	{
		if(msg.sender != controller) throw;
		_;
	}

	function DeviceRegistry(address adminInstanceAddress)
	{
		admin = Admin(adminInstanceAddress);
		controller = msg.sender;
	}

	function addDevice(string imei, address deviceInstanceAddress) 
		isController
	{
		devices.push(deviceInstanceAddress);
		deviceInstances[imei] = deviceInstanceAddress;
	}

	/*
	** Only admin can set controller with direct contract call
	** that comes through existing (e.g. new controller contract).
	*/ 

	function setController()
	{
		if(admin.getAdmin() != tx.origin) throw;
		controller = msg.sender;
	}

	function getController()
		constant
		returns(address)
	{
		return controller;
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