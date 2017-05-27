pragma solidity ^0.4.5;

import "Admin.sol";

contract MobileDevice is Admin
{
	string public constant insurance = "Mobile device";
	string public constant imeiIndicator = "imei";
	string public constant ownerIndicator = "owner";
	string public constant insuredIndicator = "insured";

	uint public lastIndex;
	uint public nextIndex;

	struct DeviceData
	{
		uint imei;
		uint owner;
		uint insured;
		bool trashed;
	}
	mapping(uint => DeviceData) public devices; // imei => DeviceData
	mapping(uint => uint) public devicesIndex; // index => imei

	event OnAddDevice(uint indexed _id, uint indexed _imei, uint _owner, uint _insured, bool _trashed);

	event OnAddDeviceHistory(uint _imei, string _insurance, uint _insuredInsuranceId, string _issueDescription, string _reparedDescription, uint _reparedPartner);
	
	event OnChangeDevice(string _changedIndicator, uint _imei, uint _newImei, uint _owner, uint _newOwner, uint _insured, uint _newInsured, bool _trashed);

	function MobileDevice()
	{
		lastIndex = 0;
		nextIndex = 0;
	}
	
	function addDevice(uint imei, uint owner, uint insured, bool trashed)
		returns (bool success)
	{	
		// If device exists? Do we care?
		// Yes! Let's not mix this with claim.
		// There can be multiple claims on one device.
		// But there cannot be same device multiple times
		// in device registry.
		if(deviceExists(imei))
		{
			return false;
		}

		devices[imei] = DeviceData
		({
			imei: imei,
			owner: owner,
			insured: insured,
			trashed: trashed
		});

		devicesIndex[nextIndex] = imei;

		lastIndex = nextIndex;
		nextIndex++;

		OnAddDevice(imei, imei, owner, insured, trashed);
		return true;
	}

	function addDeviceHistory(uint imei, uint insured, string issue, string resolution, uint partner) 
		returns(bool)
	{
		if(deviceExists(imei))
		{
			OnAddDeviceHistory(imei, insurance, insured, issue, resolution, partner);
			return true;
		}
		return false;
	}

    function deviceExists(uint imei)
        returns (bool) 
    {
        if(imei == devices[imei].imei) 
        {
        	return true;
        }
        return false;
    }

    function changeImei(uint imei, uint newImei)
    	returns (string)
    {
    	if(deviceExists(imei)) // should exist
    	{
    		if(!deviceExists(newImei)) // should not exist
    		{
    			// get device by old imei
	    		DeviceData device = devices[imei];
	    		// change device imei to new one 
	    		device.imei = newImei; 
	    		// add new device because imei changed
	    		addDevice(device.imei, device.owner, device.insured, device.trashed);
	    		// raise event 
	    		OnChangeDevice(imeiIndicator, imei, device.imei, device.owner, device.owner, device.insured, device.insured, device.trashed);
	    		// return success message
	    		return "imei change succeeded";
	    	}
	    	return "new imei exists already";
    	}
    	return "imei you are trying to change does not exist";
    }

    function changeOwner(uint imei, uint owner, uint newOwner)
    	returns (string)
    {
    	if(deviceExists(imei))
    	{
    		uint currentOwner = devices[imei].owner;
    		if(currentOwner == owner)
    		{
    			if(currentOwner != newOwner) 
    			{
		    		devices[imei].owner = newOwner;
		    		DeviceData device = devices[imei];
		    		OnChangeDevice(ownerIndicator, imei, device.imei, owner, device.owner, device.insured, device.insured, device.trashed);
		    		return "owner change succeeded";
    			}
    			return "device new owner already an owner";
    		}
    		return "device current owner not an owner";
    	}
    	return "device with imei does not exist";
    }

    // Add changeInsured
    // Add changeTrashed

    function getDeviceX(uint index)
    	returns (uint, uint, uint, bool)
    {
    	return getDevice(devicesIndex[index]);
    }

    function getDevice(uint imei) 
    	returns (uint, uint, uint, bool)
    {
    	DeviceData device = devices[imei];
    	return (device.imei, device.owner, device.insured, device.trashed);
    }
}