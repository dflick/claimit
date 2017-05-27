pragma solidity ^0.4.5;

contract Admin 
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

	function changeAdmin(address newAdmin) 
		isAdmin 
		returns(address) 
	{
		admin = newAdmin;
		OnAdminChanged(msg.sender, admin);
		return admin;
	}

	function close() 
		isAdmin 
	{
		selfdestruct(msg.sender);
	}

	function getAdmin() 
		constant
		returns(address) 
	{
		return admin;
	}
}