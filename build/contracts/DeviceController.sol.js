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
      throw new Error("DeviceController error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("DeviceController error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("DeviceController contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of DeviceController: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to DeviceController.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: DeviceController not deployed or address not set.");
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
        "constant": false,
        "inputs": [],
        "name": "setControllerToDeviceRegistry",
        "outputs": [],
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
            "type": "string"
          }
        ],
        "name": "addDevice",
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
    "unlinked_binary": "0x60606040523461000057604051606080610cf88339810160409081528151602083015191909201515b5b5b60008054600160a060020a03191633600160a060020a03161790555b60018054600160a060020a03191633600160a060020a03161790555b60028054600160a060020a03308116600160a060020a03199283161790925560038054868416908316179055600480548584169083161780825560058054868616941693909317909255604080517f8b2704ec00000000000000000000000000000000000000000000000000000000815290519290931692638b2704ec928183019260009282900301818387803b156100005760325a03f115610000575050505b5050505b610be2806101166000396000f3006060604052361561007d5763ffffffff60e060020a6000350416632b12b9e181146100825780632dc90672146100ab57806343d726d6146100ba5780636e9960c3146100c957806379c3767a146100f25780637b5e91f51461011b5780638f28397014610144578063c7eeb96d14610179578063e2e3963b146101e0575b610000565b346100005761008f610209565b60408051600160a060020a039092168252519081900360200190f35b34610000576100b8610219565b005b34610000576100b861029a565b005b346100005761008f6102c4565b60408051600160a060020a039092168252519081900360200190f35b346100005761008f6102d4565b60408051600160a060020a039092168252519081900360200190f35b346100005761008f6102e4565b60408051600160a060020a039092168252519081900360200190f35b346100005761008f600160a060020a03600435166102f4565b60408051600160a060020a039092168252519081900360200190f35b34610000576101cc600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375094965061039295505050505050565b604080519115158252519081900360200190f35b346100005761008f610690565b60408051600160a060020a039092168252519081900360200190f35b600354600160a060020a03165b90565b60015433600160a060020a0390811691161461023457610000565b60048054604080517f8b2704ec0000000000000000000000000000000000000000000000000000000081529051600160a060020a0390921692638b2704ec92828201926000929082900301818387803b156100005760325a03f115610000575050505b5b565b60015433600160a060020a039081169116146102b557610000565b33600160a060020a0316ff5b5b565b600154600160a060020a03165b90565b600254600160a060020a03165b90565b600554600160a060020a03165b90565b60015460009033600160a060020a0390811691161461031257610000565b6001805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a03848116919091179182905560408051338316815292909116602083015280517f0eff8871385f19baa9372d294e7a023dbcbe49fa8ce5df276558dc737d8f0bb69281900390910190a150600154600160a060020a03165b5b919050565b600554604080516000602091820181905282517faa3cc093000000000000000000000000000000000000000000000000000000008152925190938493600160a060020a039091169263aa3cc0939260048084019382900301818787803b156100005760325a03f115610000575050604051511515905061041157610000565b6004805460408051600060209182015290517fb71a0346000000000000000000000000000000000000000000000000000000008152928301818152865160248501528651600160a060020a039093169363b71a034693889383926044019190850190808383821561049d575b80518252602083111561049d57601f19909201916020918201910161047d565b505050905090810190601f1680156104c95780820380516001836020036101000a031916815260200191505b5092505050602060405180830381600087803b156100005760325a03f11561000057505060405151600160a060020a031615905061050a5760009150610689565b82604051610516806106a18339602091018181528251828201528251909182916040830191850190808383821561055c575b80518252602083111561055c57601f19909201916020918201910161053c565b505050905090810190601f1680156105885780820380516001836020036101000a031916815260200191505b5092505050604051809103906000f080156100005760048054604080517fa1e98bbf000000000000000000000000000000000000000000000000000000008152600160a060020a038086166024830152938101918252875160448201528751949550929091169263a1e98bbf92879286929091829160649091019060208601908083838215610632575b80518252602083111561063257601f199092019160209182019101610612565b505050905090810190601f16801561065e5780820380516001836020036101000a031916815260200191505b509350505050600060405180830381600087803b156100005760325a03f11561000057505050600191505b5b50919050565b600454600160a060020a03165b90560060606040523461000057604051610516380380610516833981016040528051015b5b60008054600160a060020a03191633600160a060020a03161790555b33600160006101000a815481600160a060020a030219169083600160a060020a031602179055508060029080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106100b057805160ff19168380011785556100dd565b828001600101855582156100dd579182015b828111156100dd5782518255916020019190600101906100c2565b5b506100fe9291505b808211156100fa57600081556001016100e6565b5090565b50506003805463ffffffff191690555b505b6103f78061011f6000396000f300606060405236156100885763ffffffff60e060020a600035041663031af76b811461008d5780631f6d083c146100ae5780633555169b146100cf57806343d726d6146100f0578063504494c9146100ff5780635eedc8f3146101135780636c70c2e1146101a0578063a1d0827c146101c1578063b764eeca146101d5578063fcdaaea4146101e9575b610000565b346100005761009a6101fd565b604080519115158252519081900360200190f35b346100005761009a61020d565b604080519115158252519081900360200190f35b346100005761009a61021e565b604080519115158252519081900360200190f35b34610000576100fd61022d565b005b34610000576100fd6004351515610259565b005b346100005761012061028e565b604080516020808252835181830152835191928392908301918501908083838215610166575b80518252602083111561016657601f199092019160209182019101610146565b505050905090810190601f1680156101925780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761009a610329565b604080519115158252519081900360200190f35b34610000576100fd6004351515610333565b005b34610000576100fd6004351515610361565b005b34610000576100fd6004351515610398565b005b60035462010000900460ff165b90565b6003546301000000900460ff165b90565b600354610100900460ff165b90565b60005433600160a060020a0390811691161461024857610000565b600054600160a060020a0316ff5b5b565b60015433600160a060020a0390811691161461027457610000565b6003805462ff0000191662010000831515021790555b5b50565b60408051602080820183526000825260028054845160018216156101000260001901909116829004601f81018490048402820184019095528481529293909183018282801561031e5780601f106102f35761010080835404028352916020019161031e565b820191906000526020600020905b81548152906001019060200180831161030157829003601f168201915b505050505090505b90565b60035460ff165b90565b60015433600160a060020a0390811691161461034e57610000565b6003805460ff19168215151790555b5b50565b60015433600160a060020a0390811691161461037c57610000565b6003805463ff00000019166301000000831515021790555b5b50565b60015433600160a060020a039081169116146103b357610000565b6003805461ff001916610100831515021790555b5b505600a165627a7a72305820b0658c6062acde0b602523dd8af3bb061701d79c63714f7b9207f06949ad9cb50029a165627a7a72305820d70ab7b139e29a6e366404c735f45f25b78d2cc215ed516af5286832e03be9830029",
    "events": {
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
    "updated_at": 1496138441513,
    "links": {},
    "address": "0x1d9e77efc20905680616b00ff29b1763e0e0b8d1"
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

  Contract.contract_name   = Contract.prototype.contract_name   = "DeviceController";
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
    window.DeviceController = Contract;
  }
})();
