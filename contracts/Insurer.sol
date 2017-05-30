pragma solidity ^0.4.5;

import "Mortal.sol";

contract Insurer is Mortal 
{
    address private controller;
    address private account;
    string private name;
    string private businessid;

    modifier isController() 
    {
        if(msg.sender != controller) throw;
        _;
    }
   
    function Insurer(address insurerAddress, string insurerName, string insurerBusinessID) 
    {
        controller = msg.sender;
        account = insurerAddress;
        name = insurerName;
        businessid = insurerBusinessID;
    }

    /*
    ** SETTERS
    */

    function setName(string insurerName)
        isController
    {
        name = insurerName;
    }

    function setBusinessID(string insurerBusinessID)
        isController
    {
        businessid = insurerBusinessID;
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