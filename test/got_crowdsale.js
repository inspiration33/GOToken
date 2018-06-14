import {expectThrow, BigNumber, increaseTimeTo} from './helpers/tools';
import {logger} from "./helpers/logger";


const {ecsign} = require('ethereumjs-util');
const abi = require('ethereumjs-abi');
const BN = require('bn.js');

const GotCrowdSale = artifacts.require('./GotCrowdSale.sol');
const GotToken = artifacts.require('./GotToken.sol');

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

// Values for testing buy methods with the required MAX_AMOUNT by Eidoo's KYCBase contract
const SIGNER_PK = Buffer.from('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', 'hex');
const MAX_AMOUNT = '7000000000000000000000';

const getKycData = (userAddr, userid, icoAddr, pk) => {
    // sha256("Eidoo icoengine authorization", icoAddress, buyerAddress, buyerId, maxAmount);
    const hash = abi.soliditySHA256(
        [ 'string', 'address', 'address', 'uint64', 'uint' ],
        [ 'Eidoo icoengine authorization', icoAddr, userAddr, new BN(userid), new BN(MAX_AMOUNT) ]
    );
    const sig = ecsign(hash, pk);
    return {
        id: userid,
        max: MAX_AMOUNT,
        v: sig.v,
        r: '0x' + sig.r.toString('hex'),
        s: '0x' + sig.s.toString('hex')
    }
};

const CROWDSALE_START_TIME = 1529406000;                                    // 19 June 2018 11:00:00 GMT
const CROWDSALE_END_TIME = 1530010800;                                      // 26 June 2018 11:00:00 GMT


const USD_PER_TOKEN = 0.75;
const USD_PER_ETHER = 600;
const TOKEN_PER_ETHER =  USD_PER_ETHER / USD_PER_TOKEN;                     // 700 GOT tokens per ether

/*INVESTORS DATA*/
// First investment: activeInvestor1
const INVESTOR1_WEI = 1e18;
const INVESTOR2_WEI = 5e18;
const INVESTOR2_WEI2 = new BigNumber(6994 * 1e18);

//const INVESTOR1_TOKEN_AMOUNT = 270 * 1e18;

/*TOKEN CAPS*/
const INTERNAL_VAULT_CAP = new BigNumber(2.85e7 * 1e18);
const PGO_UNLOCKED_LIQUIDITY_CAP = new BigNumber(1.5e7 * 1e18);
const PRESALE_VAULT_CAP = new BigNumber(1.5683388e7 * 1e18);
const PGO_VAULT_CAP = new BigNumber(3.5e7 * 1e18);
const CROWDSALE_CAP = new BigNumber(0.5816612e7 * 1e18);
const RESERVATION_CAP = new BigNumber(0.4316612e7 * 1e18);
const TOTAL_SUPPLY = new BigNumber(10e7 * 1e18);


contract('GotCrowdSale',(accounts) => {
    const owner = accounts[0];
    const activeInvestor1 = accounts[1];
    const activeInvestor2 = accounts[2];
    const activeInvestor3 = accounts[3];
    const reservationWallet = accounts[4];
    const presaleWallet = accounts[5];
    const internalWallet = accounts[6];
    const wallet = accounts[7];
    const unlockedLiquidityWallet = accounts[8];
    const internalReserveWallet = accounts[9];

    // Provide gotTokenInstance for every test case
    let gotTokenInstance;
    let gotCrowdSaleInstance;

    beforeEach(async () => {
        gotCrowdSaleInstance = await GotCrowdSale.deployed();
        const gotTokenAddress = await gotCrowdSaleInstance.token();
        gotTokenInstance = await GotToken.at(gotTokenAddress);
    });

    it('should fail, address and balances should have same length', async () => {
        const internalAddresses = [internalWallet];
        const internalBalances = [new BigNumber(2.8e7 * 1e18), new BigNumber(0.05e7 * 1e18)];
        const presaleAddresses = [presaleWallet];
        const presaleBalances = [new BigNumber(1.50e7 * 1e18), new BigNumber(0.0683388e7 * 1e18)];
        const reservationAddresses = [reservationWallet];
        const reservationBalances = [new BigNumber(0.4e7 * 1e18), new BigNumber(0.0316612e7 * 1e18)];

        await expectThrow(gotCrowdSaleInstance.initPGOMonthlyInternalVault(internalAddresses, internalBalances));
        await expectThrow(gotCrowdSaleInstance.initPGOMonthlyPresaleVault(presaleAddresses, presaleBalances));
        await expectThrow(gotCrowdSaleInstance.mintReservation(reservationAddresses, reservationBalances));
    });

    it('should fail, vaults should be initialized at correct cap', async () => {
        const internalAddresses = [internalWallet];
        const internalBalances = [new BigNumber(2.9e7 * 1e18)];
        const presaleAddresses = [presaleWallet];
        const presaleBalances = [new BigNumber(1.30e7 * 1e18)];

        await expectThrow(gotCrowdSaleInstance.initPGOMonthlyInternalVault(internalAddresses, internalBalances));
        await expectThrow(gotCrowdSaleInstance.initPGOMonthlyPresaleVault(presaleAddresses, presaleBalances));
    });

    it('should init the vaults and mint the reservation correctly and only once', async () => {
        const internalAddresses = [internalWallet];
        const internalBalances = [new BigNumber(2.85e7 * 1e18)];
        const presaleAddresses = [presaleWallet];
        const presaleBalances = [new BigNumber(1.5683388e7 * 1e18)];
        const reservationAddresses = [reservationWallet];
        const reservationBalances = [new BigNumber(0.4316612e7 * 1e18)];
        //const reservationBalances2 = [new BigNumber(0.075e7 * 1e18)];

        await gotCrowdSaleInstance.initPGOMonthlyInternalVault(internalAddresses, internalBalances);
        await gotCrowdSaleInstance.initPGOMonthlyPresaleVault(presaleAddresses, presaleBalances);
        await gotCrowdSaleInstance.mintReservation(reservationAddresses, reservationBalances);

        await expectThrow(gotCrowdSaleInstance.initPGOMonthlyInternalVault(internalAddresses, internalBalances));
        await expectThrow(gotCrowdSaleInstance.initPGOMonthlyPresaleVault(presaleAddresses, presaleBalances));
        await expectThrow(gotCrowdSaleInstance.mintReservation(reservationAddresses, reservationBalances));
    });

    it('should have token ownership', async () => {
        const gotTokenInstanceOwner = await gotTokenInstance.owner();

        gotTokenInstanceOwner.should.equal(gotCrowdSaleInstance.address);
    });

    it('should instantiate the Crowdsale correctly', async () => {
        const signer0 = await gotCrowdSaleInstance.kycSigners(0);
        const started = await gotCrowdSaleInstance.started();
        const ended = await gotCrowdSaleInstance.ended();
        const startTime = await gotCrowdSaleInstance.startTime();
        const endTime = await gotCrowdSaleInstance.endTime();
        const totalTokens = await gotCrowdSaleInstance.totalTokens();
        const remainingTokens = await gotCrowdSaleInstance.remainingTokens();
        const monthlyInternalVaultCap = await gotCrowdSaleInstance.MONTHLY_INTERNAL_VAULT_CAP();
        const unlockedLiquidityCap = await gotCrowdSaleInstance.PGO_UNLOCKED_LIQUIDITY_CAP();
        const internalReserveCap = await gotCrowdSaleInstance.PGO_INTERNAL_RESERVE_CAP();
        const reservedPresaleCap = await gotCrowdSaleInstance.RESERVED_PRESALE_CAP();
        const reservationCap = await gotCrowdSaleInstance.RESERVATION_CAP();
        const _wallet = await gotCrowdSaleInstance.wallet();
        const _unlockedLiquidityWallet = await gotCrowdSaleInstance.pgoUnlockedLiquidityWallet();
        const _internalReserveWallet = await gotCrowdSaleInstance.pgoInternalReserveWallet();
        const tokensSold = await gotCrowdSaleInstance.tokensSold();

        signer0.should.be.equal('0x627306090abaB3A6e1400e9345bC60c78a8BEf57'.toLowerCase());
        assert.isFalse(started);
        assert.isFalse(ended);
        startTime.should.be.bignumber.equal(CROWDSALE_START_TIME);
        endTime.should.be.bignumber.equal(CROWDSALE_END_TIME);
        totalTokens.should.be.bignumber.equal(CROWDSALE_CAP);
        _wallet.should.equal(wallet);
        _unlockedLiquidityWallet.should.equal(unlockedLiquidityWallet);
        _internalReserveWallet.should.equal(internalReserveWallet);
        monthlyInternalVaultCap.should.be.bignumber.equal(INTERNAL_VAULT_CAP);
        unlockedLiquidityCap.should.be.bignumber.equal(PGO_UNLOCKED_LIQUIDITY_CAP);
        internalReserveCap.should.be.bignumber.equal(PGO_VAULT_CAP);
        reservedPresaleCap.should.be.bignumber.equal(PRESALE_VAULT_CAP);
        reservationCap.should.be.bignumber.equal(RESERVATION_CAP);
        tokensSold.should.be.bignumber.equal(RESERVATION_CAP);
        //remaining tokens should be equal to CROWDSALE_CAP - RC (11500000 - 8750000 = 2750000)
        remainingTokens.should.be.bignumber.equal(CROWDSALE_CAP.sub(tokensSold));
        remainingTokens.should.be.bignumber.equal(new BigNumber(0.15e7 * 1e18));
    });

    it('should instantiate the internal vault correctly', async () => {
        const internalVaultAddress = await gotCrowdSaleInstance.pgoMonthlyInternalVault();
        const internalVaultBalance = await gotTokenInstance.balanceOf(internalVaultAddress);

        internalVaultBalance.should.be.bignumber.equal(INTERNAL_VAULT_CAP);
    });

    it('should instantiate the presale vault correctly', async () => {
        const presaleVaultAddress = await gotCrowdSaleInstance.pgoMonthlyPresaleVault();
        const presaleVaultBalance = await gotTokenInstance.balanceOf(presaleVaultAddress);

        presaleVaultBalance.should.be.bignumber.equal(PRESALE_VAULT_CAP);
    });

    it('should instantiate the ParkinGO vault correctly', async () => {
        const pgoVaultAddress = await gotCrowdSaleInstance.pgoVault();
        const pgoVaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        pgoVaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP);
    });

    it('should transfer unlocked liquidity to correct wallet', async () => {
        const unlockedLiquidityAddress = await gotCrowdSaleInstance.pgoUnlockedLiquidityWallet();
        const unlockedLiquidity = await gotTokenInstance.balanceOf(unlockedLiquidityAddress);
        unlockedLiquidity.should.be.bignumber.equal(PGO_UNLOCKED_LIQUIDITY_CAP);
        // gotCrowdSaleInstance.mintPreAllocatedTokens(); is already called in deploy phase
    });

    it('should fail, closeCrowdsale cannot be called before ICO start', async () => {
        await expectThrow(gotCrowdSaleInstance.closeCrowdsale({from: owner}));
    });

    it('should fail, finalise cannot be called before ICO start', async () => {
        await expectThrow(gotCrowdSaleInstance.finalise({from: owner}));
    });

    it('should fail, buyTokens method can not be called before crowdsale phase starts', async () => {
        const d = getKycData(activeInvestor1, 1, gotCrowdSaleInstance.address, SIGNER_PK);
        await expectThrow(gotCrowdSaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: INVESTOR1_WEI}));
    });

    it('should increase time to crowdsale start time', async () => {
        logger.info('Crowdsale phase started');
        await increaseTimeTo(CROWDSALE_START_TIME + 1);

    });

    it('should return ICO started bool to true', async () => {
        const started = await gotCrowdSaleInstance.started();
        const ended = await gotCrowdSaleInstance.ended();

        logger.info('now: ' + Date.now() + ' start: ' +  CROWDSALE_START_TIME);

        assert.isTrue(started);
        assert.isFalse(ended);
    });

    it('should calculate the token total supply correctly', async () => {
        const internalVaultAddress = await gotCrowdSaleInstance.pgoMonthlyInternalVault();
        const internalVaultBalance = await gotTokenInstance.balanceOf(internalVaultAddress);
        const presaleVaultAddress = await gotCrowdSaleInstance.pgoMonthlyPresaleVault();
        const presaleVaultBalance = await gotTokenInstance.balanceOf(presaleVaultAddress);
        const pgoVaultAddress = await gotCrowdSaleInstance.pgoVault();
        const pgoVaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);
        const unlockedLiquidityAddress = await gotCrowdSaleInstance.pgoUnlockedLiquidityWallet();
        const unlockedLiquidity = await gotTokenInstance.balanceOf(unlockedLiquidityAddress);
        const tokensSold = await gotCrowdSaleInstance.tokensSold();
        const remainingTokens = await gotCrowdSaleInstance.remainingTokens();
        const totalMintedSupply = await gotTokenInstance.totalSupply();
        const totalSupply = totalMintedSupply.add(remainingTokens);

        totalMintedSupply.should.be.bignumber.equal(
            internalVaultBalance        // 25mil
            .plus(presaleVaultBalance)  // 13.5 mil
            .plus(pgoVaultBalance)      // 35 mil
            .plus(unlockedLiquidity)    // 15 mil
            .plus(tokensSold)           // 8 mil
        );

        totalSupply.should.be.bignumber.equal(TOTAL_SUPPLY);
    });

    it('should use KYCBase buyTokens implementation to transfer ether to the contract and revert other methods', async () => {
        await expectThrow(gotCrowdSaleInstance.sendTransaction({value: INVESTOR1_WEI, from: activeInvestor1}));
    });

    it('should fail, cannot call buyTokens with a KYC unverified address', async () => {
        const SIGNER_PK_FAKE = Buffer.from('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d2', 'hex');
        const d = getKycData(activeInvestor1, 1, gotCrowdSaleInstance.address, SIGNER_PK_FAKE);
        await expectThrow(gotCrowdSaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: INVESTOR1_WEI}));
    });

    it('should buyTokens', async () => {
        const price = await gotCrowdSaleInstance.price();
        const activeInvestorBalance1 = await gotTokenInstance.balanceOf(activeInvestor1);
        const totalSupply1 = await gotTokenInstance.totalSupply();

        const d = getKycData(activeInvestor1, 1, gotCrowdSaleInstance.address, SIGNER_PK);
        await gotCrowdSaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: INVESTOR1_WEI});

        const activeInvestorBalance2 = await gotTokenInstance.balanceOf(activeInvestor1);
        const totalSupply2 = await gotTokenInstance.totalSupply();

        price.should.be.bignumber.equal(TOKEN_PER_ETHER);

        activeInvestorBalance2.should.not.be.bignumber.equal(activeInvestorBalance1);

        //may add the amount of tokens the investor1 should have as a global const and add it to totalSupply1
        totalSupply2.should.not.be.bignumber.equal(totalSupply1);
        //may add remaining tokens check as ICO SUPPLY - token.balanceOf(activeInbestorBalance)
    });

    it('should be possible to buy tokens for another account', async () => {
        const activeInvestorBalance1 = await gotTokenInstance.balanceOf(activeInvestor2);
        const totalSupply1 = await gotTokenInstance.totalSupply();

        const d = getKycData(activeInvestor2, 2, gotCrowdSaleInstance.address, SIGNER_PK);
        await gotCrowdSaleInstance.buyTokensFor(activeInvestor2, d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: INVESTOR1_WEI});

        const activeInvestorBalance2 = await gotTokenInstance.balanceOf(activeInvestor2);
        const totalSupply2 = await gotTokenInstance.totalSupply();

        activeInvestorBalance2.should.not.be.bignumber.equal(activeInvestorBalance1);
        totalSupply2.should.not.be.bignumber.equal(totalSupply1);
    });

    it('should be possible to pause the crowdsale by the owner', async () => {
        logger.info('Crowdsale phase paused');

        await gotCrowdSaleInstance.pause({from: owner});

        const paused = await gotCrowdSaleInstance.paused();
        const d = getKycData(activeInvestor2, 2, gotCrowdSaleInstance.address, SIGNER_PK);

        await expectThrow(gotCrowdSaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor2, value: INVESTOR2_WEI}));

        const activeInvestor2Balance = await gotTokenInstance.balanceOf(activeInvestor2);

        assert.isTrue(paused);
        //activeInvestor2Balance.should.be.bignumber.lessThan(800000000000000000000);
    });

    it('should be possible to unpause the crowdsale by the owner', async () => {
        logger.info('Crowdsale phase unpaused');

        await gotCrowdSaleInstance.unpause({from: owner});

        const activeInvestor2Balance = await gotTokenInstance.balanceOf(activeInvestor2);
        const paused = await gotCrowdSaleInstance.paused();

        assert.isFalse(paused);

        const d = getKycData(activeInvestor2, 2, gotCrowdSaleInstance.address, SIGNER_PK);
        await gotCrowdSaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor2, value: INVESTOR2_WEI});

        const activeInvestor2Balance2 = await gotTokenInstance.balanceOf(activeInvestor2);

        activeInvestor2Balance.should.be.bignumber.lessThan(activeInvestor2Balance2);
    });

    it('should set capReached to true after big purchase', async () => {
        const d = getKycData(activeInvestor2, 2, gotCrowdSaleInstance.address, SIGNER_PK);
        await gotCrowdSaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor2, value: INVESTOR2_WEI2});

        const capReached = await gotCrowdSaleInstance.capReached();
        console.log(capReached);

        await expectThrow(gotCrowdSaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor2, value: INVESTOR2_WEI}));

        assert.isTrue(capReached);

        //check also if remaining tokens are 0
    });

    it('should not transfer tokens before ICO end', async () => {
        await expectThrow(gotTokenInstance.transfer(activeInvestor3, 1, {from: activeInvestor1}));

        const activeInvestor3Balance = await gotTokenInstance.balanceOf(activeInvestor3);
        const activeInvestor1Balance = await gotTokenInstance.balanceOf(activeInvestor1);
        activeInvestor3Balance.should.be.bignumber.equal(0);
        //modify to make it equal to investor1_token_amount
        activeInvestor1Balance.should.not.be.equal(0);
    });

    it('should call closeCrowdsale only from the owner', async () => {
        await expectThrow(gotCrowdSaleInstance.closeCrowdsale({from: activeInvestor1}));
        await gotCrowdSaleInstance.closeCrowdsale({from: owner});

        const didOwnerEndCrowdsale = await gotCrowdSaleInstance.didOwnerEndCrowdsale();

        assert.isTrue(didOwnerEndCrowdsale);
    });

    it('should call finalise only from the owner', async () => {
        await expectThrow(gotCrowdSaleInstance.finalise({from: activeInvestor2}));
    });

    it('should increase time to crowdsale end time', async () => {
        logger.info('Crowdsale phase ended');
        await increaseTimeTo(CROWDSALE_END_TIME + 1);
    });

    it('should return true when ended method is called', async () => {
        const ended = await gotCrowdSaleInstance.ended();

        assert.isTrue(ended);
    });

    it('should finalise crowdsale sucessfully', async () => {
        let tokenPaused = await gotTokenInstance.paused();
        let mintingFinished = await gotTokenInstance.mintingFinished();
        let tokenOwner = await gotTokenInstance.owner();

        assert.isTrue(tokenPaused);
        assert.isFalse(mintingFinished);
        tokenOwner.should.equal(gotCrowdSaleInstance.address);

        await gotCrowdSaleInstance.finalise({from: owner});

        tokenPaused = await gotTokenInstance.paused();
        mintingFinished = await gotTokenInstance.mintingFinished();
        tokenOwner = await gotTokenInstance.owner();

        assert.isFalse(tokenPaused);
        assert.isTrue(mintingFinished);
        tokenOwner.should.equal(owner);
    });

    it('should allow transfer of tokens after ICO ended', async () => {
        const activeInvestor1Balance1 = await gotTokenInstance.balanceOf(activeInvestor1);
        const activeInvestor3Balance1 = await gotTokenInstance.balanceOf(activeInvestor3);

        await gotTokenInstance.transfer(activeInvestor3, 1, {from: activeInvestor1});

        const activeInvestor1Balance2 = await gotTokenInstance.balanceOf(activeInvestor1);
        const activeInvestor3Balance2 = await gotTokenInstance.balanceOf(activeInvestor3);

        activeInvestor1Balance1.should.not.be.bignumber.equal(activeInvestor1Balance2);
        activeInvestor3Balance1.should.not.be.bignumber.equal(activeInvestor3Balance2);
    });
});
