const BigNumber = web3.BigNumber;

const Got = artifacts.require("./GotToken.sol");
const GotCrowdSale = artifacts.require("./GotCrowdSale.sol");

const presaleJson = require('../config/presaleStart.json');
const reservationJson = require('../config/rcStart.json');

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
    const internalAddresses = [
        '0x6BfA7ba34FB566bbCF0B8A8A443CD2e80A5d8194',
        '0x296ebb8df0B094c283eA7e1100e49168be09C66B',
        '0x365c571424a3Fe44799179d38bc38979f35ec7Bc',
        '0xd48d6aabdc1935afaa5ef9cfe9934d82a5c0445d',
        '0xd48d6aabdc1935afaa5ef9cfe9934d82a5c0445d'

    ];
    const internalBalances = [
        new BigNumber(1.0e7 * 1e18),
        new BigNumber(0.3e7 * 1e18),
        new BigNumber(0.025e7 * 1e18),
        new BigNumber(0.175e7 * 1e18),
        new BigNumber(1.35e7 * 1e18)
    ];

    //Initialize presale addresses
    const presaleAddresses = presaleJson.Addresses;
    const presaleBalances = presaleJson.Amount.map((amount) => {
        new BigNumber(amount)
    });

    //Initialize reservation addresses
    const reservationAddresses = reservationJson.Addresses;
    const reservationBalances = reservationJson.Amount.map((amount) => {
        new BigNumber(amount);
    });

    //check that there are no duplicate addresses in presale and reservation addresses

    const presaleAddressesSet = new Set(presaleAddresses);
    const reservationAddressesSet = new Set(reservationAddresses);

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
                    if (network === "ropsten") {
                        gotCrowdSaleInstance.initPGOMonthlyInternalVault(internalAddresses, internalBalances).then(() => {
                            console.log('[ Initialized internal vault]');
                            gotCrowdSaleInstance.initPGOMonthlyPresaleVault(presaleAddressesSet, presaleBalances).then(() => {
                                console.log('[ Initialized presale vault]');
                                gotCrowdSaleInstance.mintReservation(reservationAddressesSet, reservationBalances).then(() => {
                                    console.log('[ Minted presale second step]');
                                });
                            });
                        });
                    }
                });
            });
        });
    });
};
