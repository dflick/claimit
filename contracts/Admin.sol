pragma solidity ^0.4.5;

import "Mortal.sol";

contract Admin is Mortal 
{
	address private admin;

	event OnAdminChanged(address _oldAdmin, address _newAdmin);

	modifier 
		isAdmin() 
	{
		if(msg.sender != admin) throw;
		_;
	}

	function Admin() 
	{
		admin = msg.sender;
	}

	function setAdmin(address newAdmin) 
		isAdmin 
		returns(address) 
	{
		admin = newAdmin;
		OnAdminChanged(msg.sender, admin);
		return admin;
	}

	function getAdmin() 
		constant
		returns(address) 
	{
		return admin;
	}

	function close() 
		isAdmin 
	{
		selfdestruct(admin);
	}
}