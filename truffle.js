module.exports = {
  build: {
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
  },
  rpc: {
    host: "localhost",
    port: 8545
  },
  networks: {
    "dev": {
      network_id: 42
    },
    "stg": {
      network_id: 3,
      gas: 4700000
    }
  }
};