pragma solidity ^0.4.5;

import "Mortal.sol";
import "Regulator.sol";
import "Insurer.sol";

contract InsurerRegistry is Mortal 
{
	Regulator private r;
	address[] insurers;
	// insurers address => insurers instance
	mapping (address => address) insurerInstances; 

	modifier isRegulator()
	{
		if(msg.sender != r.getRegulator()) throw;
		_;
	}

	function getRegulator()
		returns(address) 
	{
		return r.getRegulator();
	}

	function InsurerRegistry(address regulatorInstanceAddress) 
	{
		r = Regulator(regulatorInstanceAddress);
	}

	function addInsurer(address insurerAddress, string insurerName, string insurerBusinessID)
		isRegulator
	{
		Insurer insurer = new Insurer(insurers.length, insurerAddress, insurerName, insurerBusinessID);
		insurerInstances[insurerAddress] = insurer;
		insurers.push(insurer);
	}

	function getInsurerInstanceByAddress(address insurerAddress)
		constant
		returns(address)
	{
		return insurerInstances[insurerAddress];
	}

	function getInsurerInstanceByIndex(uint index) 
		constant
		returns(address)
	{
		return insurers[index];
	}

	function isInsurer()
		returns(bool)
	{
		if(insurerInstances[tx.origin] != 0x0) return true;
		return false;
	}

	function getInsurers()
		constant
		returns(address[])
	{
		return insurers;
	}
}