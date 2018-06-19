const Got = artifacts.require("./GotToken.sol");
const GotCrowdSale = artifacts.require("./GotCrowdSale.sol");
const PGOMonthlyInternalVault = artifacts.require("./PGOMonthlyInternalVault.sol");
const PGOMonthlyPresaleVault = artifacts.require("./PGOMonthlyPresaleVault.sol");

module.exports = function(deployer, network, accounts) {
    let internalReserveWallet ;//= accounts[9];
    let unlockedLiquidityWallet;// = accounts[8];
    let wallet;// = accounts[7];

    if (network === "development"){
        internalReserveWallet =  accounts[9];
        unlockedLiquidityWallet = accounts[8];
        wallet = accounts[7];
    }

    if (network === "ropsten") {
        internalReserveWallet = '0xb650238883CA8379c00c557625Aa9d1C52CCc032';
        unlockedLiquidityWallet = '0x125cBA615FB3BD79f55B984c7f0b622716aA4480';
        wallet = '0xd0f1ef60389e691676a9b92d788b730477297bd7';
    }

    if (network === "live") {
        internalReserveWallet = '0xb650238883CA8379c00c557625Aa9d1C52CCc032';
        unlockedLiquidityWallet = '0x125cBA615FB3BD79f55B984c7f0b622716aA4480';
        wallet = '0xd0f1ef60389e691676a9b92d788b730477297bd7';
    }
    
    const kycSigners = ['0x627306090abaB3A6e1400e9345bC60c78a8BEf57'.toLowerCase()];

    console.log('[ wallet.address ]: ' + wallet);
    console.log('[ internalReserveWallet.address ]: ' + internalReserveWallet);
    console.log('[ unlockedLiquidityWallet.address ]: ' + unlockedLiquidityWallet);
    console.log('[ PGOMonthlyInternalVault.address ]: ' + PGOMonthlyInternalVault.address);
    console.log('[ PGOMonthlyPresaleVault.address ]: ' + PGOMonthlyPresaleVault.address);
    console.log('[ kycSigners ]: ' + kycSigners);


    deployer.deploy(
        GotCrowdSale,
        Got.address,
        wallet,
        internalReserveWallet,
        unlockedLiquidityWallet,
        PGOMonthlyInternalVault.address,
        PGOMonthlyPresaleVault.address,
        kycSigners)
        .then(function(){
            return GotCrowdSale.deployed().then(function(gotCrowdSaleInstance){
                let gotCrowdSaleAddress = gotCrowdSaleInstance.address;
                console.log('[ gotCrowdSaleAddress.address ]: ' + gotCrowdSaleAddress);
            });
        });
};
