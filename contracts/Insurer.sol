pragma solidity ^0.4.5;

import "Admin.sol";

contract Insurer is Admin 
{
    uint index;
    address account;
    string name;
    string businessid;

    modifier isInsurer() 
    {
        if(msg.sender != account) throw;
        _;
    }
   
    function Insurer(uint x, address insurerAddress, string insurerName, string insurerBusinessID) 
    {
        index = x;
        account = insurerAddress;
        name = insurerName;
        businessid = insurerBusinessID;
    }

    /*
    ** SETTERS
    */

    function setName(string insurerName)
        isInsurer
    {
        name = insurerName;
    }

    /*
    ** GETTERS
    */

    function getAccount()
        constant
        returns(address)
    {
        return account;
    }

    function getName()
        constant
        returns(string)
    {
        return name;
    }

    function getBusinessId()
        constant
        returns(string)
    {
        return businessid;
    }
}