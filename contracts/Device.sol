// Only insurer can update device statuses
// Only insurer can add devices

pragma solidity ^0.4.5;

import "Mortal.sol";

contract Device is Mortal
{
	string private imei;
	bool private lost; // got lost
	bool private stolen; // got stolen
	bool private broke; // owner broke
	bool private scrap; // partner scrapped

	function Device(string deviceImei)
	{
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
	{
		lost = deviceLost;
	}

	function setStolen(bool deviceStolen)
	{
		stolen = deviceStolen;
	}

	function setBroke(bool deviceBroken)
	{
		broke = deviceBroken;
	}

	function setScrap(bool deviceScrapped)
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