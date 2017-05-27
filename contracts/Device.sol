pragma solidity ^0.4.5;

import "Admin.sol";

contract Device is Admin 
{
	string private imei;
	string private owner;
	string private insured;
	bool private scrap;

	function Device(string deviceImei, string deviceOwner, string deviceInsured, bool deviceScrapped)
	{
		imei = deviceImei;
		owner = deviceOwner;
		insured = deviceInsured;
		scrap = deviceScrapped;
	}

	function setOwner(string deviceOwner)
	{
		owner = deviceOwner;
	}

	function setInsured(string deviceInsured) 
	{
		insured = deviceInsured;
	}

	function setScrapped(string deviceScrapped) 
	{
		scrap = deviceScrapped;
	}
}