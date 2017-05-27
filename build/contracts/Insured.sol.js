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
      throw new Error("Insured error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Insured error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("Insured contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Insured: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to Insured.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Insured not deployed or address not set.");
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
        "name": "getNextIndex",
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
            "name": "newInsurerAddress",
            "type": "address"
          },
          {
            "name": "newInsurerName",
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
        "inputs": [
          {
            "name": "insurerAddress",
            "type": "address"
          }
        ],
        "name": "getInsurer",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "address"
          },
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
        "constant": true,
        "inputs": [
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "getInsurerAtX",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "address"
          },
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
            "name": "insurerAddress",
            "type": "address"
          }
        ],
        "name": "insurerExists",
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
            "name": "_index",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insurerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "_insurerName",
            "type": "string"
          }
        ],
        "name": "OnInsurerAdded",
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
    "unlinked_binary": "0x606060405234610000575b5b5b5b5b60008054600160a060020a03191633600160a060020a03161790555b5b60018054600160a060020a03191633600160a060020a03161790555b600160035560006002555b60016007555b5b61091d806100686000396000f3006060604052361561007d5763ffffffff60e060020a6000350416630852819081146100825780630eb7606f146100b757806334a16f72146100d657806343d726d61461014757806387e59793146101685780638f28397014610226578063b1f3bdab1461025b578063ddf248d114610310578063f7e317f41461033d575b610000565b346100005761009b600160a060020a0360043516610366565b60408051600160a060020a039092168252519081900360200190f35b34610000576100c46103f7565b60408051918252519081900360200190f35b346100005760408051602060046024803582810135601f8101859004850286018501909652858552610133958335600160a060020a031695939460449493929092019181908401838280828437509496506103fe95505050505050565b604080519115158252519081900360200190f35b346100005761013361064e565b604080519115158252519081900360200190f35b3461000057610181600160a060020a036004351661067a565b6040518084815260200183600160a060020a0316600160a060020a03168152602001806020018281038252838181518152602001915080519060200190808383600083146101ea575b8051825260208311156101ea57601f1990920191602091820191016101ca565b505050905090810190601f1680156102165780820380516001836020036101000a031916815260200191505b5094505050505060405180910390f35b346100005761009b600160a060020a0360043516610749565b60408051600160a060020a039092168252519081900360200190f35b34610000576101816004356107d8565b6040518084815260200183600160a060020a0316600160a060020a03168152602001806020018281038252838181518152602001915080519060200190808383600083146101ea575b8051825260208311156101ea57601f1990920191602091820191016101ca565b505050905090810190601f1680156102165780820380516001836020036101000a031916815260200191505b5094505050505060405180910390f35b3461000057610133600160a060020a03600435166108af565b604080519115158252519081900360200190f35b346100005761009b6108e1565b60408051600160a060020a039092168252519081900360200190f35b60015460009033600160a060020a0390811691161461038457610000565b60018054600160a060020a031916600160a060020a03848116919091179182905560408051338316815292909116602083015280517fc864dab2908c0e990862afc7488b0c28178a45d600fc7c2e255be37a8395b6fe9281900390910190a150600154600160a060020a03165b5b919050565b6003545b90565b60015460009033600160a060020a0390811691161461041c57610000565b600154600160a060020a038481169116141561043757610000565b610440836108af565b15156001141561045257506000610647565b604080516060810182526003548152600160a060020a03858116602080840182815284860188815260009384526004835295832085518155905160018083018054600160a060020a0319169290961691909117909455945180516002808801805481875295859020979897909661010090871615026000190190951604601f90810184900485019491939192909101908390106104fa57805160ff1916838001178555610527565b82800160010185558215610527579182015b8281111561052757825182559160200191906001019061050c565b5b506105489291505b808211156105445760008155600101610530565b5090565b5050600380546000908152600560209081526040918290208054600160a060020a031916600160a060020a038a169081179091558354600281905560018101909455825184815280830191909152606092810183815288519382019390935287517fb7f7026edd2c0af5c3f6790fbcdfaa2ac27bffbcca940c7f0e60169b493c936396509394508893889391926080840191908501908083838215610608575b80518252602083111561060857601f1990920191602091820191016105e8565b505050905090810190601f1680156106345780820380516001836020036101000a031916815260200191505b5094505050505060405180910390a15060015b5b92915050565b6000805433600160a060020a0390811691161461066a57610000565b33600160a060020a0316ff5b5b90565b60408051602080820183526000808352600160a060020a03851681526004825283812080546002918201805487516001821615610100026000190190911693909304601f81018690048602840186019097528683529295869594919392849289928592918391908301828280156107325780601f1061070757610100808354040283529160200191610732565b820191906000526020600020905b81548152906001019060200180831161071557829003601f168201915b505050505090509450945094505b50509193909250565b6000805433600160a060020a0390811691161461076557610000565b60008054600160a060020a031916600160a060020a03848116919091179182905560408051338316815292909116602083015280517f0eff8871385f19baa9372d294e7a023dbcbe49fa8ce5df276558dc737d8f0bb69281900390910190a150600054600160a060020a03165b5b919050565b604080516020808201835260008083528481526005825283812054600160a060020a0316808252600483528482206002908101805487516101006001831615026000190190911692909204601f810186900486028301860190975286825292958695949293928892859285928391908301828280156107325780601f1061070757610100808354040283529160200191610732565b820191906000526020600020905b81548152906001019060200180831161071557829003601f168201915b505050505090509450945094505b50509193909250565b600160a060020a038116600090815260046020526040812054819011156108d8575060016103f1565b5060005b919050565b600154600160a060020a03165b905600a165627a7a723058204e19f6c209f1a152f249372f12272309377977dc7ac0de2e5dfc5cbdb546b6fa0029",
    "events": {
      "0xb7f7026edd2c0af5c3f6790fbcdfaa2ac27bffbcca940c7f0e60169b493c9363": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_index",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "_insurerAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "_insurerName",
            "type": "string"
          }
        ],
        "name": "OnInsurerAdded",
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
    "updated_at": 1495795862492,
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

  Contract.contract_name   = Contract.prototype.contract_name   = "Insured";
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
    window.Insured = Contract;
  }
})();
