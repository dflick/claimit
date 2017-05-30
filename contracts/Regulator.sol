/*
** NOTE that if you add a regulator that is not an account in blockchain
** you are screwed. There is noway to turn that mistake back and you will
** lose the whole solution forever. This is one of the first things to 
** fix if solution would go live.
**
** Add a deposit for regulator so that regulator is able to function.
*/

pragma solidity ^0.4.5;

import "Mortal.sol";
import "Admin.sol";

contract Regulator is Mortal
{
	address private regulator;

	event OnRegulatorChanged(address _oldRegulator, address _newRegulator);
	
	modifier isRegulator() 
	{
		if(msg.sender != regulator) throw;
		_;
	}
	
	function Regulator(address adminInstanceAddress) 
	{
		regulator = msg.sender;
	}

	function getRegulator() 
		constant
		returns (address) 
	{

		return regulator;
	}

	function changeRegulator(address newRegulator)
		isRegulator
		returns (address) 
	{
		regulator = newRegulator;
		OnRegulatorChanged(msg.sender, regulator);
		return (regulator);
	}
}