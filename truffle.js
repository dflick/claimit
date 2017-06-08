var DefaultBuilder = require("truffle-default-builder");

module.exports = {
  build: new DefaultBuilder({
    "index.html": "index.html",
    "insurer.html": "insurer.html",
    "claim.html": "claim.html",
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
    "claim.js": [
      "javascripts/_vendor/angular.js",
      "javascripts/utils.js",
      "javascripts/claimController.js"
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
  }),
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*"
    },
    staging: {
      host: "localhost",
      port: 8545,
      network_id: 42
    },
    ropsten: {
      host: "localhost",
      port: 8545,
      network_id: 3
    }
  }
};