pragma solidity ^0.4.5;

contract Mortal
{
	address owner;

	modifier isOwner() 
	{
		if(msg.sender != owner) throw;
		_;
	}

	function Mortal()
	{
		owner = msg.sender;
	}

	function close()
		isOwner
	{
		selfdestruct(owner);
	}
}