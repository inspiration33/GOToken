const BigNumber = web3.BigNumber;

const Got = artifacts.require("./GotToken.sol");
const GotCrowdSale = artifacts.require("./GotCrowdSale.sol");

module.exports = function(deployer, network, accounts) {
    let internalWallet = accounts[6];
    let presaleWallet = accounts[5];
    let reservationWallet = accounts[4];

    if ( network === "ropsten") {
        internalWallet = '0x40a0a75255DBaa2b232d11241E74743354F3D583';
        presaleWallet = '0xe71E9931137A90CD2A98D71306cC2F5Bc5F801F3';
        reservationWallet = '0x57B6A3C4143A087A8d9deb6AAab67bA9D255eBBC';
    }

    //The lists of addresses and expected token amounts will be loaded here at ICO deploy time

    //Initialize internal addresses
    const internalAddresses = [internalWallet];
    const internalBalances = [new BigNumber(2.5e7 * 1e18)];
    //Initialize presale addresses
    const presaleAddresses = [presaleWallet];
    const presaleBalances = [new BigNumber(1.35e7 * 1e18)];
    //Initialize reservation addresses
    const reservationAddresses = [reservationWallet];
    const reservationBalances = [new BigNumber(0.8e7 * 1e18)];

    let gotInstance;
    let gotCrowdSaleInstance;
    //load contract instances
    Got.at(Got.address).then(x => {
        gotInstance = x;
        GotCrowdSale.at(GotCrowdSale.address).then(crowdInstance => {
            gotCrowdSaleInstance = crowdInstance;
            gotInstance.transferOwnership(GotCrowdSale.address).then(() => {
                console.log('[ Token ownership transferred to] '+ GotCrowdSale.address);
                gotCrowdSaleInstance.mintPreAllocatedTokens().then(() => {
                    console.log('[ UnlockedLiquidity minted, Internal reserve moved to PGOVAULT]');
                    gotCrowdSaleInstance.initPGOMonthlyInternalVault(internalAddresses, internalBalances).then(() => {
                        console.log('[ Initialized internal vault]');
                        gotCrowdSaleInstance.initPGOMonthlyPresaleVault(presaleAddresses, presaleBalances).then(() => {
                            console.log('[ Initialized presale vault]');
                            gotCrowdSaleInstance.mintReservation(reservationAddresses, reservationBalances).then(() => {
                                console.log('[ Minted presale second step]');
                            });
                        });
                    });
                });
            });
        });
    });
};
