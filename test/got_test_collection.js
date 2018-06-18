import {expectThrow, BigNumber, increaseTimeTo, waitNDays} from './helpers/tools';
import {logger as log, logger} from "./helpers/logger";

const {ecsign} = require('ethereumjs-util');
const abi = require('ethereumjs-abi');
const BN = require('bn.js');

const GotCrowdSale = artifacts.require('./GotCrowdSale.sol');
const GotToken = artifacts.require('./GotToken.sol');
const PGOMonthlyInternalVault = artifacts.require('./PGOMonthlyInternalVault.sol');
const PGOMonthlyPresaleVault = artifacts.require('./PGOMonthlyPresaleVault.sol');
const PGOVault = artifacts.require('./PGOVault.sol');

const should = require('chai')
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

const CROWDSALE_START_TIME = 1529402400;    // 19 June 2018 10:00:00 GMT
const CROWDSALE_END_TIME = 1530655140;      // 03 July 2018 21:59:00 GMT
const VAULT_START_TIME = 1530655141;        // 03 July 2018 21:59:01 GMT

const USD_PER_TOKEN = 0.75;
const USD_PER_ETHER = 600;                                                  // REMEMBER TO CHANGE IT AT ICO START
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
const PRESALE_VAULT_CAP = new BigNumber(1.5702889e7 * 1e18);
const PGO_VAULT_CAP = new BigNumber(3.5e7 * 1e18);
const CROWDSALE_CAP = new BigNumber(0.5797111e7 * 1e18);
const RESERVATION_CAP = new BigNumber(0.4297111e7 * 1e18);
const TOTAL_SUPPLY = new BigNumber(10e7 * 1e18);

const PGO_VAULT_STEP1 = new BigNumber(0.875e7 * 1e18);
const PGO_VAULT_STEP2 = new BigNumber(1.75e7 * 1e18);
const PGO_VAULT_STEP3 = new BigNumber(2.625e7 * 1e18);
const PGO_VAULT_STEP4 = new BigNumber(3.5e7 * 1e18);

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

    //const reservationWalletBalance = RESERVATION_CAP;
    const presaleWalletBalance = PRESALE_VAULT_CAP;
    const internalWalletBalance = INTERNAL_VAULT_CAP;

    // Provide gotTokenInstance for every test case
    let gotTokenInstance;
    let gotCrowdSaleInstance;
    let pgoMonthlyInternalVaultInstance;
    let pgoMonthlyPresaleVaultInstance;
    let pgoVaultInstance;
    let pgoVaultAddress;
    let gotTokenAddress;

    beforeEach(async () => {
        gotCrowdSaleInstance = await GotCrowdSale.deployed();
        gotTokenAddress = await gotCrowdSaleInstance.token();
        pgoVaultAddress = await gotCrowdSaleInstance.pgoVault();
        gotTokenInstance = await GotToken.at(gotTokenAddress);
        pgoVaultInstance = PGOVault.at(pgoVaultAddress);
        pgoMonthlyInternalVaultInstance = await PGOMonthlyInternalVault.deployed();
        pgoMonthlyPresaleVaultInstance = await PGOMonthlyPresaleVault.deployed();
    });

    /* GOTOKEN */

    it('should instantiate the ICO token correctly', async () => {
        const name = await gotTokenInstance.name();
        const symbol = await gotTokenInstance.symbol();
        const decimals = await gotTokenInstance.decimals();

        name.should.equal('GOToken');
        symbol.should.equal('GOT');
        decimals.should.be.bignumber.equal(18, 'Decimals does not match');
    });

    it('should fail, token can not be transferrable while on paused mode', async () => {
        await expectThrow(gotTokenInstance.transfer(activeInvestor2, 1, {from: activeInvestor1}));

        const balanceTokenHolder2 = await gotTokenInstance.balanceOf(activeInvestor2);
        balanceTokenHolder2.should.be.bignumber.equal(0);
    });

    /* CROWDSALE */

    it('should fail, address and balances should have same length', async () => {
        const internalAddresses = [internalWallet];
        const internalBalances = [new BigNumber(2.8e7 * 1e18), new BigNumber(0.05e7 * 1e18)];
        const presaleAddresses = [presaleWallet];
        const presaleBalances = [new BigNumber(1.50e7 * 1e18), new BigNumber(0.0702889e7 * 1e18)];
        const reservationAddresses = [reservationWallet];
        const reservationBalances = [new BigNumber(0.4e7 * 1e18), new BigNumber(0.0297111e7 * 1e18)];

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
        const presaleBalances = [new BigNumber(1.5702889e7 * 1e18)];
        const reservationAddresses = [reservationWallet];
        const reservationBalances = [new BigNumber(0.4297111e7 * 1e18)];
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
        //remaining tokens should be equal to CROWDSALE_CAP - RC
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
            internalVaultBalance            // 28.5 mil
                .plus(presaleVaultBalance)  // 15.6833388 mil
                .plus(pgoVaultBalance)      // 35 mil
                .plus(unlockedLiquidity)    // 15 mil
                .plus(tokensSold)           // 5.316612 mil
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
        activeInvestor2Balance.should.be.bignumber.lessThan(new BigNumber(801 * 1e18));
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

    /* MONTHLY INTERNAL VAULT / MONTHLY PRESALE VAULT / PGO VAULT */

    it('INTERNAL: should check investment data with deployed one', async () => {
        let investor = await pgoMonthlyInternalVaultInstance.getInvestment(internalWallet);
        investor[0].should.be.equal(internalWallet);
        investor[1].should.be.bignumber.equal(internalWalletBalance);
        investor[2].should.be.bignumber.equal(new BigNumber(0));
    });

    it('INTERNAL: should have vested pgo tokens', async () => {
        const balance = await gotTokenInstance.balanceOf(pgoMonthlyInternalVaultInstance.address);
        balance.should.be.bignumber.equal(internalWalletBalance);
    });

    it('PGOVAULT: should have unreleased amount equal to PGO_VAULT_CAP', async () => {
        const balance = await pgoVaultInstance.unreleasedAmount();
        balance.should.be.bignumber.equal(PGO_VAULT_CAP);
    });

    it('PGOVAULT: should initially have token amount equal to the internal reserve cap', async () => {
        const internalReserveCap = await gotCrowdSaleInstance.PGO_INTERNAL_RESERVE_CAP();
        const balance = await pgoVaultInstance.unreleasedAmount();
        balance.should.be.bignumber.equal(internalReserveCap);
    });

    it('PGOVAULT: should have vested amount 0', async () => {
        const vested = await pgoVaultInstance.vestedAmount();
        vested.should.be.bignumber.equal(new BigNumber(0));
    });

    it('INTERNAL: should check unlocked tokens before 3 months are 0', async () => {
        let beneficiary1Balance = await gotTokenInstance.balanceOf(internalWallet);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoMonthlyInternalVaultInstance.address);

        beneficiary1Balance.should.be.bignumber.equal(0);
        vaultBalance.should.be.bignumber.equal(internalWalletBalance);

        let vested = await pgoMonthlyInternalVaultInstance.vestedAmount(internalWallet);
        vested.should.be.bignumber.equal(0);

        //it will launch revert because releasable funds are 0
        await expectThrow(pgoMonthlyInternalVaultInstance.release(internalWallet));
    });

    it('PRESALE: should check unlocked tokens before 3 months are 1/3', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        let beneficiary1Balance = await gotTokenInstance.balanceOf(presaleWallet);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoMonthlyPresaleVaultInstance.address);

        beneficiary1Balance.should.be.bignumber.equal(0);
        vaultBalance.should.be.bignumber.equal(presaleWalletBalance);

        const vested = await pgoMonthlyPresaleVaultInstance.vestedAmount(presaleWallet);
        vested.should.be.bignumber.equal(presaleWalletBalance.div(3));

        let releasable = await pgoMonthlyPresaleVaultInstance.releasableAmount(presaleWallet);
        releasable.should.be.bignumber.equal(presaleWalletBalance.div(3));

        await pgoMonthlyPresaleVaultInstance.release(presaleWallet);

        releasable = await pgoMonthlyPresaleVaultInstance.releasableAmount(presaleWallet);
        releasable.should.be.bignumber.equal(0);

        beneficiary1Balance = await gotTokenInstance.balanceOf(presaleWallet);
        vaultBalance = await gotTokenInstance.balanceOf(pgoMonthlyPresaleVaultInstance.address);

        beneficiary1Balance.should.be.bignumber.equal(presaleWalletBalance.div(3));
        vaultBalance.should.be.bignumber.equal(presaleWalletBalance.sub(presaleWalletBalance.div(3)));
    });

    it('INTERNAL: should check 1/21 of token are unlocked after 4 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(120);
        await pgoMonthlyInternalVaultInstance.release(internalWallet);

        let beneficiary1Balance = await gotTokenInstance.balanceOf(internalWallet);
        let div21BeneficiaryBalance = internalWalletBalance.dividedBy(21);

        div21BeneficiaryBalance.should.be.bignumber.equal(beneficiary1Balance);
    });

    it('PRESALE: should check 1/21 of token are unlocked after 4 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await pgoMonthlyPresaleVaultInstance.release(presaleWallet);

        const beneficiary1Balance = await gotTokenInstance.balanceOf(presaleWallet);

        log.info(beneficiary1Balance);

        const div21BeneficiaryBalance = presaleWalletBalance.mul(2).div(3).div(21);
        const initial33percentBalance = presaleWalletBalance.div(3);

        beneficiary1Balance.should.be.bignumber.equal(div21BeneficiaryBalance.add(initial33percentBalance));
    });

    it('INTERNAL: should check 2/21 of token are unlocked after 5 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(30);
        await pgoMonthlyInternalVaultInstance.release(internalWallet);

        let beneficiary1Balance = await gotTokenInstance.balanceOf(internalWallet);
        let div21BeneficiaryBalance = internalWalletBalance.dividedBy(21);

        div21BeneficiaryBalance = div21BeneficiaryBalance.mul(2);

        div21BeneficiaryBalance.should.be.bignumber.equal(beneficiary1Balance);
    });

    it('PRESALE: should check 2/21 of token are unlocked after 5 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await pgoMonthlyPresaleVaultInstance.release(presaleWallet);

        let beneficiary1Balance = await gotTokenInstance.balanceOf(presaleWallet);

        log.info(beneficiary1Balance);

        let div21BeneficiaryBalance = presaleWalletBalance.mul(2).div(3).div(21);
        div21BeneficiaryBalance = div21BeneficiaryBalance.mul(2);
        const initial33percentBalance = presaleWalletBalance.div(3);

        beneficiary1Balance.should.be.bignumber.equal(div21BeneficiaryBalance.add(initial33percentBalance));
    });

    it('INTERNAL: should check 3/21 of token are unlocked after 6 months by calling .release() from an external address', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(30);
        await pgoMonthlyInternalVaultInstance.contract.release[''].sendTransaction({from: internalWallet});

        let beneficiary1Balance = await gotTokenInstance.balanceOf(internalWallet);
        let div21BeneficiaryBalance = internalWalletBalance.dividedBy(21);

        div21BeneficiaryBalance = div21BeneficiaryBalance.mul(3);

        div21BeneficiaryBalance.should.be.bignumber.equal(beneficiary1Balance);
    });

    it('PRESALE: should check 3/21 of token are unlocked after 6 months by calling .release() from an external address', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await pgoMonthlyPresaleVaultInstance.contract.release[''].sendTransaction({from: presaleWallet});

        let beneficiary1Balance = await gotTokenInstance.balanceOf(presaleWallet);

        let div21BeneficiaryBalance = presaleWalletBalance.mul(2).div(3).div(21);
        div21BeneficiaryBalance = div21BeneficiaryBalance.mul(3);
        const initial33percentBalance = presaleWalletBalance.div(3);

        beneficiary1Balance.should.be.bignumber.equal(div21BeneficiaryBalance.add(initial33percentBalance));
    });

    it('PGOVAULT: should release internal reserve liquidity vested at step 1', async () => {
        await waitNDays(181);

        let internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.be.bignumber.equal(0);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP);

        const vested = await pgoVaultInstance.vestedAmount();
        vested.should.be.bignumber.equal(PGO_VAULT_STEP1);

        await pgoVaultInstance.release();

        internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.not.be.bignumber.equal(0);
        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP1);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP - PGO_VAULT_STEP1);
    });

    it('PGOVAULT: should release internal reserve liquidity vested at step 2', async () => {
        await waitNDays(180);

        let internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP1);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP - PGO_VAULT_STEP1);

        const vested = await pgoVaultInstance.vestedAmount();
        vested.should.be.bignumber.equal(PGO_VAULT_STEP2);

        await pgoVaultInstance.release();

        internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.not.be.bignumber.equal(PGO_VAULT_STEP1);
        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP2);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP - PGO_VAULT_STEP2);
    });

    it('PGOVAULT: should release internal reserve liquidity vested at step 3', async () => {
        await waitNDays(180);

        let internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP2);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP - PGO_VAULT_STEP2);

        const vested = await pgoVaultInstance.vestedAmount();
        vested.should.be.bignumber.equal(PGO_VAULT_STEP3);

        await pgoVaultInstance.release();

        internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP3);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP.minus(PGO_VAULT_STEP3));
    });

    it('PGOVAULT: should release internal reserve liquidity vested at step 4', async () => {
        await waitNDays(180);

        let internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP3);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP.minus(PGO_VAULT_STEP3));

        const vested = await pgoVaultInstance.vestedAmount();
        vested.should.be.bignumber.equal(PGO_VAULT_STEP4);

        await pgoVaultInstance.release();

        internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP4);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP - PGO_VAULT_STEP4);
        vaultBalance.should.be.bignumber.equal(0);
    });

    it('PGOVAULT: should not not have any internal reserve liquidity left to release', async () => {
        await waitNDays(40);

        let internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP4);
        vaultBalance.should.be.bignumber.equal(PGO_VAULT_CAP - PGO_VAULT_STEP4);

        const vested = await pgoVaultInstance.vestedAmount();
        vested.should.be.bignumber.equal(PGO_VAULT_STEP4);

        await expectThrow(pgoVaultInstance.release());

        internalReserveWalletBalance = await gotTokenInstance.balanceOf(internalReserveWallet);
        vaultBalance = await gotTokenInstance.balanceOf(pgoVaultAddress);

        internalReserveWalletBalance.should.be.bignumber.equal(PGO_VAULT_STEP4);
        vaultBalance.should.be.bignumber.equal(0);
    });

    it('PGOVAULT: should finally have vault token amount equal to 0', async () => {
        const internalReserveCap = await gotCrowdSaleInstance.PGO_INTERNAL_RESERVE_CAP();
        const balance = await pgoVaultInstance.unreleasedAmount();
        balance.should.not.be.bignumber.equal(internalReserveCap);
        balance.should.be.bignumber.equal(0);
    });

    it('INTERNAL: should release all token after vault end ', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        const days = 30*36;
        const endTime = VAULT_START_TIME + (days * 24 * 60 * 60);

        await increaseTimeTo(endTime);

        await pgoMonthlyInternalVaultInstance.release.sendTransaction(internalWallet);

        const beneficiary1Balance = await gotTokenInstance.balanceOf(internalWallet);

        internalWalletBalance.should.be.bignumber.equal(beneficiary1Balance);
    });

    it('PRESALE: should release all token after vault end ', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await pgoMonthlyPresaleVaultInstance.release(presaleWallet);

        const beneficiary1Balance = await gotTokenInstance.balanceOf(presaleWallet);

        beneficiary1Balance.should.be.bignumber.equal(presaleWalletBalance);
    });



    it('BURNING: burns the requested amount', async function () {
        let amount = new BigNumber(20 * 1e18);    
        await this.token.burn(amount, { from : activeInvestor1});

        const balance = await this.token.balanceOf(activeInvestor1);
        balance.should.be.bignumber.equal(initialBalance - amount);
      });

});