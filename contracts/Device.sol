// Only registry can update device statuses
// Only registry can add devices

pragma solidity ^0.4.5;

import "Mortal.sol";

contract Device is Mortal
{
	address controller;
	string private imei;
	bool private lost; // got lost
	bool private stolen; // got stolen
	bool private broke; // owner broke
	bool private scrap; // partner scrapped

	modifier isController()
	{
		if(controller != msg.sender) throw;
		_;
	}

	/*
	** CHECK OUT DEPLOY SEQUENCE. IS IT POSSIBLE TO SET CONTROLLER AT THIS POINT
	*/	

	function Device(string deviceImei)
	{
		controller = msg.sender;
		imei = deviceImei;
		lost = false;
		stolen = false;
		broke = false;
		scrap = false;
	}

	function getImei()
		constant
		returns(string)
	{
		return imei;
	}

	/*
	** SETTERS
	*/

	function setLost(bool deviceLost)
		isController
	{
		lost = deviceLost;
	}

	function setStolen(bool deviceStolen)
		isController
	{
		stolen = deviceStolen;
	}

	function setBroke(bool deviceBroken)
		isController
	{
		broke = deviceBroken;
	}

	function setScrap(bool deviceScrapped)
		isController
	{
		scrap = deviceScrapped;
	}

	/*
	** GETTERS
	*/

	function getLost()
		constant
		returns(bool)
	{
		return lost;
	}

	function getStolen()
		constant
		returns(bool)
	{
		return stolen;
	}
	
	function getBroke()
		constant
		returns(bool)
	{
		return broke;
	}

	function getScrap()
		constant
		returns(bool)
	{
		return scrap;
	}
}