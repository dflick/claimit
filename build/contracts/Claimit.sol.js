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
      throw new Error("Claimit error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Claimit error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("Claimit contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Claimit: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to Claimit.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Claimit not deployed or address not set.");
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
        "name": "getRegulatorInstance",
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
        "name": "getControllerInstance",
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
        "name": "getInsurerRegistryInstance",
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
            "name": "insurerAddress",
            "type": "address"
          },
          {
            "name": "insurerName",
            "type": "string"
          },
          {
            "name": "insurerBusinessID",
            "type": "string"
          }
        ],
        "name": "addInsurer",
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
            "type": "string"
          },
          {
            "name": "lost",
            "type": "bool"
          },
          {
            "name": "stolen",
            "type": "bool"
          },
          {
            "name": "broke",
            "type": "bool"
          },
          {
            "name": "scrap",
            "type": "bool"
          }
        ],
        "name": "addDeviceClaim",
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
        "name": "getDeviceRegistryInstance",
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
        "inputs": [
          {
            "name": "regulatorInstanceAddress",
            "type": "address"
          },
          {
            "name": "deviceRegistryAddress",
            "type": "address"
          },
          {
            "name": "insurerRegistryAddress",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_timestamp",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insurer",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "_imei",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_claimreason",
            "type": "string"
          }
        ],
        "name": "onDeviceClaim",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60606040523461000057604051606080611f378339810160409081528151602083015191909201515b60008054600160a060020a03808616600160a060020a031992831617835560018054868316908416179081905560028054868416941693909317909255604080517f8b2704ec00000000000000000000000000000000000000000000000000000000815290519290911692638b2704ec9260048084019382900301818387803b156100005760325a03f115610000575050600254604080517f8b2704ec0000000000000000000000000000000000000000000000000000000081529051600160a060020a039092169250638b2704ec91600480830192600092919082900301818387803b156100005760325a03f115610000575050505b5050505b611e05806101326000396000f3006060604052361561005c5763ffffffff60e060020a6000350416632b12b9e1811461006157806379c3767a1461008a5780637b5e91f5146100b357806383e9dcb3146100dc578063b36335a71461018a578063e2e3963b14610208575b610000565b346100005761006e610231565b60408051600160a060020a039092168252519081900360200190f35b346100005761006e610241565b60408051600160a060020a039092168252519081900360200190f35b346100005761006e610246565b60408051600160a060020a039092168252519081900360200190f35b346100005760408051602060046024803582810135601f8101859004850286018501909652858552610176958335600160a060020a0316959394604494939290920191819084018382808284375050604080516020601f89358b0180359182018390048302840183019094528083529799988101979196509182019450925082915084018382808284375094965061025695505050505050565b604080519115158252519081900360200190f35b34610000576101f6600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505050508235151592602081013515159250604081013515159150606001351515610507565b60408051918252519081900360200190f35b346100005761006e6110e8565b60408051600160a060020a039092168252519081900360200190f35b600054600160a060020a03165b90565b305b90565b600254600160a060020a03165b90565b6000805460408051602090810184905281517ff7e317f400000000000000000000000000000000000000000000000000000000815291518493600160a060020a033381169491169263f7e317f49260048084019382900301818887803b156100005760325a03f11561000057505060405151600160a060020a03169190911490506102e057610000565b6002546040805160006020918201819052825160e060020a6387e59793028152600160a060020a038a81166004830152935193909416936387e59793936024808301949391928390030190829087803b156100005760325a03f11561000057505060405151600160a060020a031615905061035e57600091506104fe565b84848460405161075e80620010f98339018084600160a060020a0316600160a060020a0316815260200180602001806020018381038352858181518152602001915080519060200190808383600083146103d3575b8051825260208311156103d357601f1990920191602091820191016103b3565b505050905090810190601f1680156103ff5780820380516001836020036101000a031916815260200191505b508381038252845181528451602091820191860190808383821561043e575b80518252602083111561043e57601f19909201916020918201910161041e565b505050905090810190601f16801561046a5780820380516001836020036101000a031916815260200191505b5095505050505050604051809103906000f0801561000057600254604080517f998561d6000000000000000000000000000000000000000000000000000000008152600160a060020a0389811660048301528085166024830152915193945091169163998561d69160448082019260009290919082900301818387803b156100005760325a03f11561000057505050600191505b5b509392505050565b6002546040805160006020918201819052825160e060020a6387e59793028152600160a060020a03338116600483015293519194859485949116926387e5979392602480820193929182900301818787803b156100005760325a03f11561000057505060405151600160a060020a03161515905061058457610000565b60015460408051600060209182015290517fb71a0346000000000000000000000000000000000000000000000000000000008152600481018281528b5160248301528b51600160a060020a039094169363b71a0346938d9383926044909101918501908083838215610611575b80518252602083111561061157601f1990920191602091820191016105f1565b505050905090810190601f16801561063d5780820380516001836020036101000a031916815260200191505b5092505050602060405180830381600087803b156100005760325a03f11561000057505060405151925050600160a060020a0382161515610bb457878787878760405161056380620018578339851515910160208181019290925284151560408201528315156060820152821515608082015260a080825287519082015286519091829160c083019189019080838382156106f3575b8051825260208311156106f357601f1990920191602091820191016106d3565b505050905090810190601f16801561071f5780820380516001836020036101000a031916815260200191505b509650505050505050604051809103906000f0801561000057600154604080517fa1e98bbf000000000000000000000000000000000000000000000000000000008152600160a060020a038085166024830152600482019283528c5160448301528c519495509092169263a1e98bbf928c92869290918291606490910190602086019080838382156107cc575b8051825260208311156107cc57601f1990920191602091820191016107ac565b505050905090810190601f1680156107f85780820380516001836020036101000a031916815260200191505b509350505050600060405180830381600087803b156100005760325a03f1156100005750505086156108fb5760008051602062001dba83398151915242338a6040518084815260200183600160a060020a0316600160a060020a0316815260200180602001806020018381038352848181518152602001915080519060200190808383600083146108a4575b8051825260208311156108a457601f199092019160209182019101610884565b505050905090810190601f1680156108d05780820380516001836020036101000a031916815260200191505b509283039052506004815260e260020a631b1bdcdd0260208201526040805191829003019350915050a15b85156109da5760008051602062001dba83398151915242338a6040518084815260200183600160a060020a0316600160a060020a031681526020018060200180602001838103835284818151815260200191508051906020019080838360008314610981575b80518252602083111561098157601f199092019160209182019101610961565b505050905090810190601f1680156109ad5780820380516001836020036101000a031916815260200191505b509283039052506006815260d160020a6539ba37b632b70260208201526040805191829003019350915050a15b8415610ab85760008051602062001dba83398151915242338a6040518084815260200183600160a060020a0316600160a060020a031681526020018060200180602001838103835284818151815260200191508051906020019080838360008314610a60575b805182526020831115610a6057601f199092019160209182019101610a40565b505050905090810190601f168015610a8c5780820380516001836020036101000a031916815260200191505b509283039052506005815260d860020a6462726f6b650260208201526040805191829003019350915050a15b8315610bab5760008051602062001dba83398151915242338a6040518084815260200183600160a060020a0316600160a060020a031681526020018060200180602001838103835284818151815260200191508051906020019080838360008314610b3e575b805182526020831115610b3e57601f199092019160209182019101610b1e565b505050905090810190601f168015610b6a5780820380516001836020036101000a031916815260200191505b50928303905250600581527f736372617000000000000000000000000000000000000000000000000000000060208201526040805191829003019350915050a15b600192506110dc565b50808615610cfb57604080517fa1d0827c00000000000000000000000000000000000000000000000000000000815288151560048201529051600160a060020a0383169163a1d0827c91602480830192600092919082900301818387803b156100005760325a03f1156100005750505060008051602062001dba83398151915242338a6040518084815260200183600160a060020a0316600160a060020a031681526020018060200180602001838103835284818151815260200191508051906020019080838360008314610ca4575b805182526020831115610ca457601f199092019160209182019101610c84565b505050905090810190601f168015610cd05780820380516001836020036101000a031916815260200191505b509283039052506004815260e260020a631b1bdcdd0260208201526040805191829003019350915050a15b8515610e4257604080517ffcdaaea400000000000000000000000000000000000000000000000000000000815287151560048201529051600160a060020a0383169163fcdaaea491602480830192600092919082900301818387803b156100005760325a03f1156100005750505060008051602062001dba83398151915242338a6040518084815260200183600160a060020a0316600160a060020a031681526020018060200180602001838103835284818151815260200191508051906020019080838360008314610de9575b805182526020831115610de957601f199092019160209182019101610dc9565b505050905090810190601f168015610e155780820380516001836020036101000a031916815260200191505b509283039052506006815260d160020a6539ba37b632b70260208201526040805191829003019350915050a15b8415610f8857604080517f504494c900000000000000000000000000000000000000000000000000000000815286151560048201529051600160a060020a0383169163504494c991602480830192600092919082900301818387803b156100005760325a03f1156100005750505060008051602062001dba83398151915242338a6040518084815260200183600160a060020a0316600160a060020a031681526020018060200180602001838103835284818151815260200191508051906020019080838360008314610f30575b805182526020831115610f3057601f199092019160209182019101610f10565b505050905090810190601f168015610f5c5780820380516001836020036101000a031916815260200191505b509283039052506005815260d860020a6462726f6b650260208201526040805191829003019350915050a15b83156110ce57604080517fb764eeca00000000000000000000000000000000000000000000000000000000815285151560048201529051600160a060020a0383169163b764eeca91602480830192600092919082900301818387803b156100005760325a03f1156100005750505060008051602062001dba83398151915242338a6040518084815260200183600160a060020a0316600160a060020a031681526020018060200180602001838103835284818151815260200191508051906020019080838360008314611076575b80518252602083111561107657601f199092019160209182019101611056565b505050905090810190601f1680156110a25780820380516001836020036101000a031916815260200191505b509283039052506005815260d860020a6462726f6b650260208201526040805191829003019350915050a15b600292506110dc565b600392505b5b505095945050505050565b600154600160a060020a03165b9056006060604052346100005760405161075e38038061075e8339810160409081528151602083015191830151909291820191015b5b60008054600160a060020a03191633600160a060020a03161790555b60018054600160a060020a03338116600160a060020a03199283161783556002805491871691909216178155835160038054600082905290936020601f9183161561010002600019019092169390930483018190047fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b9081019390918701908390106100e557805160ff1916838001178555610112565b82800160010185558215610112579182015b828111156101125782518255916020019190600101906100f7565b5b506101339291505b8082111561012f576000815560010161011b565b5090565b50508060049080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061018157805160ff19168380011785556101ae565b828001600101855582156101ae579182015b828111156101ae578251825591602001919060010190610193565b5b506101cf9291505b8082111561012f576000815560010161011b565b5090565b50505b5050505b610579806101e56000396000f3006060604052361561005c5763ffffffff60e060020a60003504166317d7de7c811461006157806343d726d6146100ee5780639efb2700146100fd578063c47f00271461018a578063c92278a7146101df578063db613e8114610234575b610000565b346100005761006e61025d565b6040805160208082528351818301528351919283929083019185019080838382156100b4575b8051825260208311156100b457601f199092019160209182019101610094565b505050905090810190601f1680156100e05780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576100fb6102fb565b005b346100005761006e610327565b6040805160208082528351818301528351919283929083019185019080838382156100b4575b8051825260208311156100b457601f199092019160209182019101610094565b505050905090810190601f1680156100e05780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576100fb600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496506103c595505050505050565b005b34610000576100fb600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375094965061048195505050505050565b005b346100005761024161053d565b60408051600160a060020a039092168252519081900360200190f35b60408051602080820183526000825260038054845160026001831615610100026000190190921691909104601f8101849004840282018401909552848152929390918301828280156102f05780601f106102c5576101008083540402835291602001916102f0565b820191906000526020600020905b8154815290600101906020018083116102d357829003601f168201915b505050505090505b90565b60005433600160a060020a0390811691161461031657610000565b600054600160a060020a0316ff5b5b565b60408051602080820183526000825260048054845160026001831615610100026000190190921691909104601f8101849004840282018401909552848152929390918301828280156102f05780601f106102c5576101008083540402835291602001916102f0565b820191906000526020600020905b8154815290600101906020018083116102d357829003601f168201915b505050505090505b90565b60015433600160a060020a039081169116146103e057610000565b8060039080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061042c57805160ff1916838001178555610459565b82800160010185558215610459579182015b8281111561045957825182559160200191906001019061043e565b5b5061047a9291505b808211156104765760008155600101610462565b5090565b50505b5b50565b60015433600160a060020a0390811691161461049c57610000565b8060049080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061042c57805160ff1916838001178555610459565b82800160010185558215610459579182015b8281111561045957825182559160200191906001019061043e565b5b5061047a9291505b808211156104765760008155600101610462565b5090565b50505b5b50565b600254600160a060020a03165b905600a165627a7a7230582013315a9cb6da77e7e24dd5660be6152a95e22bc1a0e55874cf7f65157c51eeeb002960606040523461000057604051610563380380610563833981016040908152815160208301519183015160608401516080850151929094019390915b5b60008054600160a060020a03191633600160a060020a03161790555b33600160006101000a815481600160a060020a030219169083600160a060020a031602179055508460029080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106100cb57805160ff19168380011785556100f8565b828001600101855582156100f8579182015b828111156100f85782518255916020019190600101906100dd565b5b506101199291505b808211156101155760008155600101610101565b5090565b50506003805460ff19168515151761ff001916610100851515021762ff0000191662010000841515021763ff00000019166301000000831515021790555b50505050505b6103f78061016c6000396000f300606060405236156100885763ffffffff60e060020a600035041663031af76b811461008d5780631f6d083c146100ae5780633555169b146100cf57806343d726d6146100f0578063504494c9146100ff5780635eedc8f3146101135780636c70c2e1146101a0578063a1d0827c146101c1578063b764eeca146101d5578063fcdaaea4146101e9575b610000565b346100005761009a6101fd565b604080519115158252519081900360200190f35b346100005761009a61020d565b604080519115158252519081900360200190f35b346100005761009a61021e565b604080519115158252519081900360200190f35b34610000576100fd61022d565b005b34610000576100fd6004351515610259565b005b346100005761012061028e565b604080516020808252835181830152835191928392908301918501908083838215610166575b80518252602083111561016657601f199092019160209182019101610146565b505050905090810190601f1680156101925780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761009a610329565b604080519115158252519081900360200190f35b34610000576100fd6004351515610333565b005b34610000576100fd6004351515610361565b005b34610000576100fd6004351515610398565b005b60035462010000900460ff165b90565b6003546301000000900460ff165b90565b600354610100900460ff165b90565b60005433600160a060020a0390811691161461024857610000565b600054600160a060020a0316ff5b5b565b60015433600160a060020a0390811691161461027457610000565b6003805462ff0000191662010000831515021790555b5b50565b60408051602080820183526000825260028054845160018216156101000260001901909116829004601f81018490048402820184019095528481529293909183018282801561031e5780601f106102f35761010080835404028352916020019161031e565b820191906000526020600020905b81548152906001019060200180831161030157829003601f168201915b505050505090505b90565b60035460ff165b90565b60015433600160a060020a0390811691161461034e57610000565b6003805460ff19168215151790555b5b50565b60015433600160a060020a0390811691161461037c57610000565b6003805463ff00000019166301000000831515021790555b5b50565b60015433600160a060020a039081169116146103b357610000565b6003805461ff001916610100831515021790555b5b505600a165627a7a72305820c3e657a9fa6b7c0c3a66a012a83053f8463255cd3716fb9e9a08f5093762303a0029bd8838be74a7c8641a8b0d6dda343f30cc59c89e0662112a0f228fb091ee2f53a165627a7a723058207a2ba66bd0ab420a38362e8b5848a72e14389c2cfedeb02f9b5eaefb6373711c0029",
    "events": {
      "0xbd8838be74a7c8641a8b0d6dda343f30cc59c89e0662112a0f228fb091ee2f53": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_timestamp",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insurer",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "_imei",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_claimreason",
            "type": "string"
          }
        ],
        "name": "onDeviceClaim",
        "type": "event"
      }
    },
    "updated_at": 1496320967808,
    "links": {},
    "address": "0x3bece2294680eefe059c00b996ba0e1ee785c04b"
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

  Contract.contract_name   = Contract.prototype.contract_name   = "Claimit";
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
    window.Claimit = Contract;
  }
})();
