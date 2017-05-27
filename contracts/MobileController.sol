pragma solidity ^0.4.5;

import "Admin.sol";
import "Regulator.sol";
import "Insurer.sol";
import "Device.sol";

contract MobileController is Admin
{
	address regulator;
	address[] public insurers;
	address[] public claims;

	// insurer address => insurer instance address
	mapping (address => address) insurerInstances;

	// insurer address => MobileDevice instance address
	mapping (address => address) insurerClaims;

	function MobileController() 
	{
		Regulator r = new Regulator();
		regulator = r;
	}

	function addInsurer(address insurerAddress, string insurerName, string insurerBusinessID)
	{
		Insurer insurer = new Insurer(insurers.length, insurerAddress, insurerName, insurerBusinessID);
		insurerInstances[insurerAddress] = insurer;
		insurers.push(insurer.getAccount());
	}

	function getInsurer(uint index)
		constant
		returns(address) 
	{
		return insurers[index];
	}

	function getInsurers()
		constant
		returns(address[])
	{
		return insurers;
	}
}