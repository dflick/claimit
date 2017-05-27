// This needs to be initialised in $window.onload function
var initUtils = function (web3) {

    // Found here https://gist.github.com/xavierlepretre/88682e871f4ad07be4534ae560692ee6
    web3.eth.getTransactionReceiptMined = function (txnHash, interval) {
        var transactionReceiptAsync;
        interval = interval ? interval : 500;
        transactionReceiptAsync = function(txnHash, resolve, reject) {
            try {
                // callback added 22.2.2017 when Metamask demanded it. 
                // Metamask does not allow asynchronous calls without callback functions.
                var receipt = web3.eth.getTransactionReceipt(txnHash);
                if (receipt == null) {
                    setTimeout(function () {
                        transactionReceiptAsync(txnHash, resolve, reject);
                    }, interval);
                } else {
                    resolve(receipt);
                }
            } catch(e) {
                reject(e);
            }
        };

        return new Promise(function (resolve, reject) {
                transactionReceiptAsync(txnHash, resolve, reject);
        });
    };

};