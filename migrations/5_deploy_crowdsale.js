const Got = artifacts.require("./GotToken.sol");
const GotCrowdSale = artifacts.require("./GotCrowdSale.sol");
const PGOMonthlyInternalVault = artifacts.require("./PGOMonthlyInternalVault.sol");
const PGOMonthlyPresaleVault = artifacts.require("./PGOMonthlyPresaleVault.sol");

module.exports = function(deployer, network, accounts) {
    let internalReserveWallet = accounts[9];
    let unlockedLiquidityWallet = accounts[8];
    let wallet = accounts[7];

    if ( network === "ropsten") {
        internalReserveWallet = '0x7eA91A18B73569103fc8391356E03C03AEdDd215';
        unlockedLiquidityWallet = '0xB635fBa8569606d67922498e27B4095644FF4aEe';
        wallet = '0xdc09d15e4269c373e75614Eed7bddf65d24a8731';
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
