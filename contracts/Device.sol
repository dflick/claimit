pragma solidity ^0.4.5;

import "Mortal.sol";

contract Device is Mortal
{
	address private controller;
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

	function Device(string deviceImei, bool deviceLost, bool deviceStolen, bool deviceBroke, bool deviceScrap)
	{
		controller = msg.sender;
		imei = deviceImei;
		lost = deviceLost;
		stolen = deviceStolen;
		broke = deviceBroke;
		scrap = deviceScrap;
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

	function getImei()
		constant
		returns(string)
	{
		return imei;
	}

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