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
      throw new Error("Insurance error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Insurance error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("Insurance contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Insurance: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to Insurance.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Insurance not deployed or address not set.");
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
        "constant": false,
        "inputs": [
          {
            "name": "newInsuranceName",
            "type": "string"
          },
          {
            "name": "newInsuranceDescription",
            "type": "string"
          }
        ],
        "name": "addInsurance",
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
            "name": "newRegulator",
            "type": "address"
          }
        ],
        "name": "changeRegulator",
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
        "name": "close",
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
        "inputs": [],
        "name": "getLastInsuranceId",
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
        "name": "getNextInsuranceId",
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
            "name": "atIndex",
            "type": "uint256"
          },
          {
            "name": "newInsuranceName",
            "type": "string"
          },
          {
            "name": "newInsuranceDescription",
            "type": "string"
          }
        ],
        "name": "changeInsurance",
        "outputs": [
          {
            "name": "index",
            "type": "uint256"
          },
          {
            "name": "insuranceName",
            "type": "string"
          },
          {
            "name": "insuranceDescription",
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
            "name": "atIndex",
            "type": "uint256"
          }
        ],
        "name": "getInsurance",
        "outputs": [
          {
            "name": "index",
            "type": "uint256"
          },
          {
            "name": "insuranceName",
            "type": "string"
          },
          {
            "name": "insuranceDescription",
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
        "constant": true,
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
        "inputs": [],
        "payable": false,
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_insuranceIndex",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insuranceName",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_insuranceDescription",
            "type": "string"
          }
        ],
        "name": "OnInsuranceAdded",
        "type": "event"
      },
      {
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
    "unlinked_binary": "0x606060405234610000575b5b5b5b60008054600160a060020a03191633600160a060020a03161790555b5b60018054600160a060020a03191633600160a060020a03161790555b60016003555b5b610c428061005c6000396000f3006060604052361561007d5763ffffffff60e060020a60003504166305087bf08114610082578063085281901461012657806343d726d61461015b5780634f724cd01461017c5780636fa051e91461019b578063750ddb90146101ba57806385fae602146103485780638f28397014610455578063f7e317f41461048a575b610000565b3461000057610112600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375050604080516020601f89358b018035918201839004830284018301909452808352979998810197919650918201945092508291508401838280828437509496506104b395505050505050565b604080519115158252519081900360200190f35b346100005761013f600160a060020a036004351661077e565b60408051600160a060020a039092168252519081900360200190f35b346100005761011261081c565b604080519115158252519081900360200190f35b3461000057610189610848565b60408051918252519081900360200190f35b346100005761018961084f565b60408051918252519081900360200190f35b346100005760408051602060046024803582810135601f810185900485028601850190965285855261024b958335959394604494939290920191819084018382808284375050604080516020601f89358b0180359182018390048302840183019094528083529799988101979196509182019450925082915084018382808284375094965061085695505050505050565b6040518084815260200180602001806020018381038352858181518152602001915080519060200190808383600083146102a0575b8051825260208311156102a057601f199092019160209182019101610280565b505050905090810190601f1680156102cc5780820380516001836020036101000a031916815260200191505b508381038252845181528451602091820191860190808383821561030b575b80518252602083111561030b57601f1990920191602091820191016102eb565b505050905090810190601f1680156103375780820380516001836020036101000a031916815260200191505b509550505050505060405180910390f35b346100005761024b600435610a01565b6040518084815260200180602001806020018381038352858181518152602001915080519060200190808383600083146102a0575b8051825260208311156102a057601f199092019160209182019101610280565b505050905090810190601f1680156102cc5780820380516001836020036101000a031916815260200191505b508381038252845181528451602091820191860190808383821561030b575b80518252602083111561030b57601f1990920191602091820191016102eb565b505050905090810190601f1680156103375780820380516001836020036101000a031916815260200191505b509550505050505060405180910390f35b346100005761013f600160a060020a0360043516610b6a565b60408051600160a060020a039092168252519081900360200190f35b346100005761013f610c06565b60408051600160a060020a039092168252519081900360200190f35b60015460009033600160a060020a039081169116146104d157610000565b604060405190810160405280848152602001838152506004600060035481526020019081526020016000206000820151816000019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061054e57805160ff191683800117855561057b565b8280016001018555821561057b579182015b8281111561057b578251825591602001919060010190610560565b5b5061059c9291505b808211156105985760008155600101610584565b5090565b50506020820151816001019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106105f057805160ff191683800117855561061d565b8280016001018555821561061d579182015b8281111561061d578251825591602001919060010190610602565b5b5061063e9291505b808211156105985760008155600101610584565b5090565b50506003805460028190556001810190915560408051828152606060208083018281528a519284019290925289517f44d09fccfe5b4ef3be8397a59d8a9a7028f830e8c32451f8e1a714d3440880f697509495508994899484019160808501919087019080838382156106cc575b8051825260208311156106cc57601f1990920191602091820191016106ac565b505050905090810190601f1680156106f85780820380516001836020036101000a031916815260200191505b5083810382528451815284516020918201918601908083838215610737575b80518252602083111561073757601f199092019160209182019101610717565b505050905090810190601f1680156107635780820380516001836020036101000a031916815260200191505b509550505050505060405180910390a15060015b5b92915050565b60015460009033600160a060020a0390811691161461079c57610000565b6001805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a03848116919091179182905560408051338316815292909116602083015280517fc864dab2908c0e990862afc7488b0c28178a45d600fc7c2e255be37a8395b6fe9281900390910190a150600154600160a060020a03165b5b919050565b6000805433600160a060020a0390811691161461083857610000565b33600160a060020a0316ff5b5b90565b6002545b90565b6003545b90565b60408051602081810183526000808352835191820190935282815260015433600160a060020a0390811691161461088c57610000565b50506040805180820182528481526020808201859052600087815260048252928320825180518254838752958490208a975089968996958594601f600260001961010060018716150201909416939093048301829004840194939291019083901061090257805160ff191683800117855561092f565b8280016001018555821561092f579182015b8281111561092f578251825591602001919060010190610914565b5b506109509291505b808211156105985760008155600101610584565b5090565b50506020820151816001019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106109a457805160ff19168380011785556109d1565b828001600101855582156109d1579182015b828111156109d15782518255916020019190600101906109b6565b5b506109f29291505b808211156105985760008155600101610584565b5090565b505050505b5b93509350939050565b6040805160208181018352600080835283518083018552818152858252600483529084902080548551601f6002600019610100600186161502019093169290920491820185900485028101850190965280865286959293830182828015610aa95780601f10610a7e57610100808354040283529160200191610aa9565b820191906000526020600020905b815481529060010190602001808311610a8c57829003601f168201915b50505050509150600460008581526020019081526020016000206001018054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610b5a5780601f10610b2f57610100808354040283529160200191610b5a565b820191906000526020600020905b815481529060010190602001808311610b3d57829003601f168201915b50939450505050505b9193909250565b6000805433600160a060020a03908116911614610b8657610000565b6000805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a03848116919091179182905560408051338316815292909116602083015280517f0eff8871385f19baa9372d294e7a023dbcbe49fa8ce5df276558dc737d8f0bb69281900390910190a150600054600160a060020a03165b5b919050565b600154600160a060020a03165b905600a165627a7a72305820cb58eaf48d69cfc05917cff6697c5c401b16ac729dcaa6796febaf1db517d3140029",
    "events": {
      "0x44d09fccfe5b4ef3be8397a59d8a9a7028f830e8c32451f8e1a714d3440880f6": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_insuranceIndex",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insuranceName",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "_insuranceDescription",
            "type": "string"
          }
        ],
        "name": "OnInsuranceAdded",
        "type": "event"
      },
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
    "updated_at": 1495795862473,
    "links": {},
    "address": "0xcf4297a848d69c9715818b4bf60681de42b34309"
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

  Contract.contract_name   = Contract.prototype.contract_name   = "Insurance";
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
    window.Insurance = Contract;
  }
})();
