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
      throw new Error("InsurerRegistry error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("InsurerRegistry error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("InsurerRegistry contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of InsurerRegistry: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to InsurerRegistry.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: InsurerRegistry not deployed or address not set.");
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
        "name": "getInsurers",
        "outputs": [
          {
            "name": "",
            "type": "address[]"
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
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "insurerAddress",
            "type": "address"
          }
        ],
        "name": "getInsurerInstanceByAddress",
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
        "inputs": [],
        "name": "isInsurer",
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
        "constant": true,
        "inputs": [
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "getInsurerInstanceByIndex",
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
        "inputs": [],
        "name": "getRegulator",
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
          }
        ],
        "payable": false,
        "type": "constructor"
      }
    ],
    "events": {
      "0xc864dab2908c0e990862afc7488b0c28178a45d600fc7c2e255be37a8395b6fe": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_oldRegulator",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "_newRegulator",
            "type": "address"
          }
        ],
        "name": "OnRegulatorChanged",
        "type": "event"
      }
    },
    "updated_at": 1496119390182,
    "links": {},
    "unlinked_binary": "0x60606040523461000057604051602080610df383398101604052515b5b60008054600160a060020a03191633600160a060020a03161790555b60018054600160a060020a031916600160a060020a0383161790555b505b610d8e806100656000396000f300606060405236156100675763ffffffff60e060020a60003504166311569586811461006c57806343d726d6146100d457806383e9dcb3146100e35780638450d5b91461017f578063aa3cc093146101b4578063b96bee92146101d5578063f7e317f414610201575b610000565b346100005761007961022a565b60408051602080825283518183015283519192839290830191858101910280838382156100c1575b8051825260208311156100c157601f1990920191602091820191016100a1565b5050509050019250505060405180910390f35b34610000576100e1610295565b005b346100005760408051602060046024803582810135601f81018590048502860185019096528585526100e1958335600160a060020a0316959394604494939290920191819084018382808284375050604080516020601f89358b018035918201839004830284018301909452808352979998810197919650918201945092508291508401838280828437509496506102c195505050505050565b005b3461000057610198600160a060020a0360043516610520565b60408051600160a060020a039092168252519081900360200190f35b34610000576101c1610541565b604080519115158252519081900360200190f35b3461000057610198600435610572565b60408051600160a060020a039092168252519081900360200190f35b34610000576101986105a8565b60408051600160a060020a039092168252519081900360200190f35b60408051602081810183526000825260028054845181840281018401909552808552929392909183018282801561028a57602002820191906000526020600020905b8154600160a060020a0316815260019091019060200180831161026c575b505050505090505b90565b60005433600160a060020a039081169116146102b057610000565b600054600160a060020a0316ff5b5b565b6001546040805160006020918201819052825160e260020a633df8c5fd02815292519093600160a060020a03169263f7e317f492600480830193919282900301818787803b156100005760325a03f1156100005750506040515133600160a060020a03908116911614905061033557610000565b6002805490508484846040516107598061060a8339018085815260200184600160a060020a0316600160a060020a0316815260200180602001806020018381038352858181518152602001915080519060200190808383600083146103b5575b8051825260208311156103b557601f199092019160209182019101610395565b505050905090810190601f1680156103e15780820380516001836020036101000a031916815260200191505b5083810382528451815284516020918201918601908083838215610420575b80518252602083111561042057601f199092019160209182019101610400565b505050905090810190601f16801561044c5780820380516001836020036101000a031916815260200191505b509650505050505050604051809103906000f0801561000057600160a060020a038581166000908152600360205260409020805473ffffffffffffffffffffffffffffffffffffffff19169183169190911790556002805460018101808355929350909182818380158290116104e7576000838152602090206104e79181019083015b808211156104e357600081556001016104cf565b5090565b5b505050916000526020600020900160005b8154600160a060020a038086166101009390930a92830292021916179055505b5b50505050565b600160a060020a03808216600090815260036020526040902054165b919050565b600160a060020a033281166000908152600360205260408120549091161561056b57506001610292565b5060005b90565b6000600282815481101561000057906000526020600020900160005b9054906101000a9004600160a060020a031690505b919050565b6001546040805160006020918201819052825160e260020a633df8c5fd02815292519093600160a060020a03169263f7e317f492600480830193919282900301818787803b156100005760325a03f115610000575050604051519150505b9056006060604052346100005760405161075938038061075983398101604090815281516020830151918301516060840151919390810191015b5b60008054600160a060020a03191633600160a060020a03161790555b600184815560028054600160a060020a031916600160a060020a038616178155835160038054600082905290937fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b602061010092841615929092026000190190921693909304601f9081018490048201938701908390106100df57805160ff191683800117855561010c565b8280016001018555821561010c579182015b8281111561010c5782518255916020019190600101906100f1565b5b5061012d9291505b808211156101295760008155600101610115565b5090565b50508060049080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061017b57805160ff19168380011785556101a8565b828001600101855582156101a8579182015b828111156101a857825182559160200191906001019061018d565b5b506101c99291505b808211156101295760008155600101610115565b5090565b50505b505050505b610579806101e06000396000f3006060604052361561005c5763ffffffff60e060020a60003504166317d7de7c811461006157806343d726d6146100ee5780639efb2700146100fd578063c47f00271461018a578063c92278a7146101df578063db613e8114610234575b610000565b346100005761006e61025d565b6040805160208082528351818301528351919283929083019185019080838382156100b4575b8051825260208311156100b457601f199092019160209182019101610094565b505050905090810190601f1680156100e05780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576100fb6102fb565b005b346100005761006e610327565b6040805160208082528351818301528351919283929083019185019080838382156100b4575b8051825260208311156100b457601f199092019160209182019101610094565b505050905090810190601f1680156100e05780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576100fb600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496506103c595505050505050565b005b34610000576100fb600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375094965061048195505050505050565b005b346100005761024161053d565b60408051600160a060020a039092168252519081900360200190f35b60408051602080820183526000825260038054845160026001831615610100026000190190921691909104601f8101849004840282018401909552848152929390918301828280156102f05780601f106102c5576101008083540402835291602001916102f0565b820191906000526020600020905b8154815290600101906020018083116102d357829003601f168201915b505050505090505b90565b60005433600160a060020a0390811691161461031657610000565b600054600160a060020a0316ff5b5b565b60408051602080820183526000825260048054845160026001831615610100026000190190921691909104601f8101849004840282018401909552848152929390918301828280156102f05780601f106102c5576101008083540402835291602001916102f0565b820191906000526020600020905b8154815290600101906020018083116102d357829003601f168201915b505050505090505b90565b60025433600160a060020a039081169116146103e057610000565b8060039080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061042c57805160ff1916838001178555610459565b82800160010185558215610459579182015b8281111561045957825182559160200191906001019061043e565b5b5061047a9291505b808211156104765760008155600101610462565b5090565b50505b5b50565b60025433600160a060020a0390811691161461049c57610000565b8060049080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061042c57805160ff1916838001178555610459565b82800160010185558215610459579182015b8281111561045957825182559160200191906001019061043e565b5b5061047a9291505b808211156104765760008155600101610462565b5090565b50505b5b50565b600254600160a060020a03165b905600a165627a7a72305820995d2863387409a2a91ec4aaf80dd2c26f949dfea0d6563cf55ed2fce3d642cf0029a165627a7a72305820a5244f5b82157b59f779492678f2b54fb586bd2f9fb1ddff6652eff69f1cb5360029",
    "address": "0xead365c933ae35447691eb63463ab7468901cff4"
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

  Contract.contract_name   = Contract.prototype.contract_name   = "InsurerRegistry";
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
    window.InsurerRegistry = Contract;
  }
})();