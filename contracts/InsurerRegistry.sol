pragma solidity ^0.4.5;

import "Admin.sol";
import "Mortal.sol";
import "Regulator.sol";
import "Insurer.sol";

contract InsurerRegistry is Mortal 
{
	Admin private admin;
	address private controller;

	address[] private insurers;
	// insurer's address => insurer's instance
	mapping (address => address) insurerInstances; 

	modifier isController()
	{
		if(controller != msg.sender) throw;
		_;
	}

	function InsurerRegistry(address adminInstanceAddress) 
	{
		admin = Admin(adminInstanceAddress);
		controller = msg.sender;
	}

	function addInsurer(address insurerAddress, address insurerInstanceAddress)
		isController
	{
		insurerInstances[insurerAddress] = insurerInstanceAddress;
		insurers.push(insurerInstanceAddress);
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

	function getInsurer(address insurerAddress)
		constant
		returns(address)
	{
		return insurerInstances[insurerAddress];
	}

	function getInsurers()
		constant
		returns(address[])
	{
		return insurers;
	}
}