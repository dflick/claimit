var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("MobileDevice error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("MobileDevice error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("MobileDevice contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of MobileDevice: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to MobileDevice.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: MobileDevice not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [],
        "name": "imeiIndicator",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "imei",
            "type": "uint256"
          }
        ],
        "name": "getDevice",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "devices",
        "outputs": [
          {
            "name": "imei",
            "type": "uint256"
          },
          {
            "name": "owner",
            "type": "uint256"
          },
          {
            "name": "insured",
            "type": "uint256"
          },
          {
            "name": "trashed",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "close",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "getDeviceX",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "ownerIndicator",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getAdmin",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "insurance",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "newAdmin",
            "type": "address"
          }
        ],
        "name": "changeAdmin",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "imei",
            "type": "uint256"
          }
        ],
        "name": "deviceExists",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "imei",
            "type": "uint256"
          },
          {
            "name": "insured",
            "type": "uint256"
          },
          {
            "name": "issue",
            "type": "string"
          },
          {
            "name": "resolution",
            "type": "string"
          },
          {
            "name": "partner",
            "type": "uint256"
          }
        ],
        "name": "addDeviceHistory",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "imei",
            "type": "uint256"
          },
          {
            "name": "newImei",
            "type": "uint256"
          }
        ],
        "name": "changeImei",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "devicesIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "imei",
            "type": "uint256"
          },
          {
            "name": "owner",
            "type": "uint256"
          },
          {
            "name": "newOwner",
            "type": "uint256"
          }
        ],
        "name": "changeOwner",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "imei",
            "type": "uint256"
          },
          {
            "name": "owner",
            "type": "uint256"
          },
          {
            "name": "insured",
            "type": "uint256"
          },
          {
            "name": "trashed",
            "type": "bool"
          }
        ],
        "name": "addDevice",
        "outputs": [
          {
            "name": "success",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "lastIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "nextIndex",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "insuredIndicator",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "payable": false,
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "_id",
            "type": "uint256"
          },
          {
            "indexed": true,
            "name": "_imei",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_owner",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insured",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_trashed",
            "type": "bool"
          }
        ],
        "name": "OnAddDevice",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_imei",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insurance",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_insuredInsuranceId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_issueDescription",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_reparedDescription",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_reparedPartner",
            "type": "uint256"
          }
        ],
        "name": "OnAddDeviceHistory",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_changedIndicator",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_imei",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_newImei",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_owner",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_newOwner",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insured",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_newInsured",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_trashed",
            "type": "bool"
          }
        ],
        "name": "OnChangeDevice",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_oldAdmin",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "_newAdmin",
            "type": "address"
          }
        ],
        "name": "OnAdminChanged",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b5b5b60008054600160a060020a03191633600160a060020a03161790555b60018054600160a060020a03191633600160a060020a03161790555b600060028190556003555b5b6110ef8061005f6000396000f300606060405236156100df5763ffffffff60e060020a600035041662565c7d81146100e457806309f110b11461017157806310ff8e31146101a957806343d726d6146101e1578063587f9d2b146101f0578063591e71e2146102285780636e9960c3146102b557806389cf3204146102de5780638f2839701461036b5780639d5af13f146103a05780639e2a19aa146103c4578063a31355161461046e578063ae05031114610501578063c7e2b66414610523578063f04bfee0146105b9578063f3f6f0d7146105e8578063fc7e9c6f14610607578063fde4e36814610626575b610000565b34610000576100f16106b3565b604080516020808252835181830152835191928392908301918501908083838215610137575b80518252602083111561013757601f199092019160209182019101610117565b505050905090810190601f1680156101635780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576101816004356106d4565b6040805194855260208501939093528383019190915215156060830152519081900360800190f35b3461000057610181600435610708565b6040805194855260208501939093528383019190915215156060830152519081900360800190f35b34610000576101ee610732565b005b346100005761018160043561075c565b6040805194855260208501939093528383019190915215156060830152519081900360800190f35b34610000576100f161078a565b604080516020808252835181830152835191928392908301918501908083838215610137575b80518252602083111561013757601f199092019160209182019101610117565b505050905090810190601f1680156101635780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576102c26107ac565b60408051600160a060020a039092168252519081900360200190f35b34610000576100f16107bc565b604080516020808252835181830152835191928392908301918501908083838215610137575b80518252602083111561013757601f199092019160209182019101610117565b505050905090810190601f1680156101635780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576102c2600160a060020a03600435166107f3565b60408051600160a060020a039092168252519081900360200190f35b34610000576103b0600435610891565b604080519115158252519081900360200190f35b3461000057604080516020600460443581810135601f81018490048402850184019095528484526103b094823594602480359560649492939190920191819084018382808284375050604080516020601f89358b0180359182018390048302840183019094528083529799988101979196509182019450925082915084018382808284375094965050933593506108b892505050565b604080519115158252519081900360200190f35b34610000576100f1600435602435610ab5565b604080516020808252835181830152835191928392908301918501908083838215610137575b80518252602083111561013757601f199092019160209182019101610117565b505050905090810190601f1680156101635780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610511600435610d0b565b60408051918252519081900360200190f35b34610000576100f1600435602435604435610d1d565b604080516020808252835181830152835191928392908301918501908083838215610137575b80518252602083111561013757601f199092019160209182019101610117565b505050905090810190601f1680156101635780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576103b06004356024356044356064351515610f9d565b604080519115158252519081900360200190f35b3461000057610511611080565b60408051918252519081900360200190f35b3461000057610511611086565b60408051918252519081900360200190f35b34610000576100f161108c565b604080516020808252835181830152835191928392908301918501908083838215610137575b80518252602083111561013757601f199092019160209182019101610117565b505050905090810190601f1680156101635780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b604080518082019091526004815260e060020a63696d656902602082015281565b6000818152600460205260409020805460018201546002830154600384015492939192909160ff909116905b509193509193565b60046020526000908152604090208054600182015460028301546003909301549192909160ff1684565b60015433600160a060020a0390811691161461074d57610000565b33600160a060020a0316ff5b5b565b60008181526005602052604081205481908190819061077a906106d4565b93509350935093505b9193509193565b604080518082019091526005815260d960020a6437bbb732b902602082015281565b600154600160a060020a03165b90565b60408051808201909152600d81527f4d6f62696c652064657669636500000000000000000000000000000000000000602082015281565b60015460009033600160a060020a0390811691161461081157610000565b6001805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a03848116919091179182905560408051338316815292909116602083015280517f0eff8871385f19baa9372d294e7a023dbcbe49fa8ce5df276558dc737d8f0bb69281900390910190a150600154600160a060020a03165b5b919050565b6000818152600460205260408120548214156108af5750600161088b565b5060005b919050565b60006108c386610891565b15610aa8577f7d9b542b303b3efb3f1cc4046c745147114f5cfd6de76b907aa4c02bbeff539586604060405190810160405280600d81526020017f4d6f62696c652064657669636500000000000000000000000000000000000000815250878787876040518087815260200180602001868152602001806020018060200185815260200184810384528981815181526020019150805190602001908083836000831461098a575b80518252602083111561098a57601f19909201916020918201910161096a565b505050905090810190601f1680156109b65780820380516001836020036101000a031916815260200191505b50848103835287518152875160209182019189019080838382156109f5575b8051825260208311156109f557601f1990920191602091820191016109d5565b505050905090810190601f168015610a215780820380516001836020036101000a031916815260200191505b5084810382528651815286516020918201918801908083838215610a60575b805182526020831115610a6057601f199092019160209182019101610a40565b505050905090810190601f168015610a8c5780820380516001836020036101000a031916815260200191505b50995050505050505050505060405180910390a1506001610aac565b5060005b95945050505050565b60408051602081019091526000808252610ace84610891565b15610ca457610adc83610891565b1515610c6957506000838152600460205260409020828155600181015460028201546003830154610b13928692909160ff16610f9d565b506040805180820182526004815260e060020a63696d6569026020808301918252845460018601546002870154600388015487519485018c9052968401839052606084018290526080840182905260a0840181905260c0840181905260ff90961680151560e085015261010080855286519085015285517f01aa05f98ef3819681d3b5dbf29d65a9e88fd27bc21b6fc5a49894daea469e0f978c96949593948594919384939092918291610120830191908083838215610bee575b805182526020831115610bee57601f199092019160209182019101610bce565b505050905090810190601f168015610c1a5780820380516001836020036101000a031916815260200191505b50995050505050505050505060405180910390a160408051808201909152601581527f696d6569206368616e676520737563636565646564000000000000000000000060208201529150610d04565b60408051808201909152601781527f6e657720696d65692065786973747320616c726561647900000000000000000060208201529150610d04565b606060405190810160405280602c81526020017f696d656920796f752061726520747279696e6720746f206368616e676520646f81526020017f6573206e6f74206578697374000000000000000000000000000000000000000081525091505b5092915050565b60056020526000908152604090205481565b6040805160208101909152600080825280610d3786610891565b15610f5d57600086815260046020526040902060010154915084821415610f1257818414610ec7575060008581526004602090815260409182902060018101869055825180840184526005815260d960020a6437bbb732b90281840190815282546002840154600385015487519687018d9052968601829052606086018b9052608086018a905260a0860181905260c0860181905260ff90961680151560e0870152610100808752845190870152835194967f01aa05f98ef3819681d3b5dbf29d65a9e88fd27bc21b6fc5a49894daea469e0f9694958d9593948d948d94849390928291610120830191908083838215610e4c575b805182526020831115610e4c57601f199092019160209182019101610e2c565b505050905090810190601f168015610e785780820380516001836020036101000a031916815260200191505b50995050505050505050505060405180910390a160408051808201909152601681527f6f776e6572206368616e6765207375636365656465640000000000000000000060208201529250610f94565b606060405190810160405280602181526020017f646576696365206e6577206f776e657220616c726561647920616e206f776e65815260200160f960020a6039028152509250610f94565b606060405190810160405280602181526020017f6465766963652063757272656e74206f776e6572206e6f7420616e206f776e65815260200160f960020a6039028152509250610f94565b60408051808201909152601f81527f646576696365207769746820696d656920646f6573206e6f7420657869737400602082015292505b50509392505050565b6000610fa885610891565b15610fb557506000611078565b604080516080810182528681526020808201878152828401878152861515606080860182815260008d815260048752888120975188559451600180890191909155935160028089019190915590516003978801805460ff19169115159190911790558654855260058652938790208c9055855493849055929091019093558351888152918201879052818401929092529151879283927fe5322dc357e9d42b5abe06b0b6a220057432758301320b9b2bb51c772e68c25d92918290030190a35060015b949350505050565b60025481565b60035481565b60408051808201909152600781527f696e7375726564000000000000000000000000000000000000000000000000006020820152815600a165627a7a72305820743cdc60cfa0b622f71f29b47f91138d455bf1bf6a2403b96db3599986b5bf910029",
    "events": {
      "0xe5322dc357e9d42b5abe06b0b6a220057432758301320b9b2bb51c772e68c25d": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "_id",
            "type": "uint256"
          },
          {
            "indexed": true,
            "name": "_imei",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_owner",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insured",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_trashed",
            "type": "bool"
          }
        ],
        "name": "OnAddDevice",
        "type": "event"
      },
      "0x7d9b542b303b3efb3f1cc4046c745147114f5cfd6de76b907aa4c02bbeff5395": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_imei",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insurance",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_insuredInsuranceId",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_issueDescription",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_reparedDescription",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_reparedPartner",
            "type": "uint256"
          }
        ],
        "name": "OnAddDeviceHistory",
        "type": "event"
      },
      "0x01aa05f98ef3819681d3b5dbf29d65a9e88fd27bc21b6fc5a49894daea469e0f": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_changedIndicator",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_imei",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_newImei",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_owner",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_newOwner",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insured",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_newInsured",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_trashed",
            "type": "bool"
          }
        ],
        "name": "OnChangeDevice",
        "type": "event"
      },
      "0x0eff8871385f19baa9372d294e7a023dbcbe49fa8ce5df276558dc737d8f0bb6": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_oldAdmin",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "_newAdmin",
            "type": "address"
          }
        ],
        "name": "OnAdminChanged",
        "type": "event"
      }
    },
    "updated_at": 1495981906971,
    "links": {}
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "MobileDevice";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.MobileDevice = Contract;
  }
})();
