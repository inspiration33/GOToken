//require('dotenv').config();
require('babel-register')({
  ignore: /node_modules\/(?!openzeppelin-solidity)/
});
require('babel-polyfill');

const HDWalletProvider = require("truffle-hdwallet-provider");
const mnemonicRopsten = "stuff limit piano short armor like swarm drill raw earn firm consider";
const mnemonicLive = "DONT WRITE IT HERE USE A SEPARATE GITIGNORED FILE"

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*" // Match any network id
    },   
    QA: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "3",
      gas: 2900000
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(mnemonicRopsten, "http://23.227.175.82:8545");
      },
      network_id: 3,
      gas: 4612388
    },
    live: {
      provider: function() {
        return new HDWalletProvider(mnemonicLive, "http://174.138.15.5:8546");
      },
      network_id: 1,
    }
  }
};