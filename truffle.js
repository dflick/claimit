module.exports = {
  build: {
    "index.html": "index.html",
    "insurer.html": "insurer.html",
    "insurance.html": "insurance.html",
    "mobiledevice.html": "mobiledevice.html",
    "app.js": [
      "javascripts/app.js"
    ],
    "regulator.js": [
      "javascripts/_vendor/angular.js",
      "javascripts/utils.js",
      "javascripts/regulatorController.js"
    ],
    "insurer.js": [
      "javascripts/_vendor/angular.js",
      "javascripts/utils.js",
      "javascripts/insurerController.js"
    ],
    "insurance.js": [
      "javascripts/_vendor/angular.js",
      "javascripts/utils.js",
      "javascripts/insuranceController.js"
    ],
    "mobiledevice.js": [
      "javascripts/_vendor/angular.js",
      "javascripts/utils.js",
      "javascripts/mobileDeviceController.js"
    ],
    "node/server.js": [
      "node/prepare.js",
      "node/server.js"
    ],
    "node/listen.js": [
      "node/prepare.js",
      "node/listen.js"
    ],
    "app.css": [
      "stylesheets/app.css"
    ],
    "images/": "images/"
  },
  rpc: {
    host: "localhost",
    port: 8545
  }
};