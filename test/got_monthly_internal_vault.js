import {expectThrow, waitNDays, BigNumber, increaseTimeTo} from './helpers/tools';
import {logger as log} from "./helpers/logger";

const GotCrowdSale = artifacts.require('./GotCrowdSale.sol');
const PGOMonthlyInternalVault = artifacts.require('./PGOMonthlyInternalVault.sol');
const GotToken = artifacts.require('./GotToken.sol');

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const VAULT_START_TIME = 1530655141;      // 03 July 2018 21:59:01 GMT

contract('PGOMonthlyInternalVault',(accounts) => {
    const beneficiary1 = accounts[6];
    const beneficiary1_balance = new BigNumber(2.85e7 * 1e18);

    // Provide gotTokenInstance for every test case
    let gotTokenInstance;
    let gotCrowdSaleInstance;
    let pgoMonthlyInternalVaultInstance;

    beforeEach(async () => {
        gotCrowdSaleInstance = await GotCrowdSale.deployed();
        const gotTokenAddress = await gotCrowdSaleInstance.token();
        gotTokenInstance = await GotToken.at(gotTokenAddress);
        pgoMonthlyInternalVaultInstance = await PGOMonthlyInternalVault.deployed();
    });

    it('should init the vaults and mint the reservation correctly', async () => {
        const internalAddresses = [accounts[6]];
        const internalBalances = [new BigNumber(2.85e7 * 1e18)];
        const presaleAddresses = [accounts[5]];
        const presaleBalances = [new BigNumber(1.5702889e7 * 1e18)];
        const reservationAddresses = [accounts[4]];
        const reservationBalances = [new BigNumber(0.4297111e7 * 1e18)];

        await gotCrowdSaleInstance.initPGOMonthlyInternalVault(internalAddresses, internalBalances);
        await gotCrowdSaleInstance.initPGOMonthlyPresaleVault(presaleAddresses, presaleBalances);
        await gotCrowdSaleInstance.mintReservation(reservationAddresses, reservationBalances);
    });

    it('should check investment data with deployed one', async () => {
        let investor = await pgoMonthlyInternalVaultInstance.getInvestment(beneficiary1);
        investor[0].should.be.equal(beneficiary1);
        investor[1].should.be.bignumber.equal(beneficiary1_balance);
        investor[2].should.be.bignumber.equal(new BigNumber(0));
    });
    
    it('should have vested pgo tokens', async () => {
        const balance = await gotTokenInstance.balanceOf(pgoMonthlyInternalVaultInstance.address);
        balance.should.be.bignumber.equal(beneficiary1_balance);
    });

    it('should increase time to ICO END', async () => {
        log.info('[ ICO END TIME ]');
        await increaseTimeTo(VAULT_START_TIME);

        await gotCrowdSaleInstance.finalise();
        log.info('[ Finalized ]');
    });

    it('should check unlocked tokens before 3 months are 0', async () => {
        let beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoMonthlyInternalVaultInstance.address);

        beneficiary1Balance.should.be.bignumber.equal(0);
        vaultBalance.should.be.bignumber.equal(beneficiary1_balance);

        let vested = await pgoMonthlyInternalVaultInstance.vestedAmount(beneficiary1);
        vested.should.be.bignumber.equal(0);

        //it will launch revert because releasable funds are 0
        await expectThrow(pgoMonthlyInternalVaultInstance.release(beneficiary1));
    });

    it('should check 1/21 of token are unlocked after 4 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(120);
        await pgoMonthlyInternalVaultInstance.release(beneficiary1);

        let beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);
        let div21BeneficiaryBalance = beneficiary1_balance.dividedBy(21);
        
        div21BeneficiaryBalance.should.be.bignumber.equal(beneficiary1Balance);
    });

    it('should check 2/21 of token are unlocked after 5 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(30);
        await pgoMonthlyInternalVaultInstance.release(beneficiary1);

        let beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);
        let div21BeneficiaryBalance = beneficiary1_balance.dividedBy(21);

        div21BeneficiaryBalance = div21BeneficiaryBalance.mul(2);

        div21BeneficiaryBalance.should.be.bignumber.equal(beneficiary1Balance);
    });

    it('should check 3/21 of token are unlocked after 6 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(30);
        await pgoMonthlyInternalVaultInstance.contract.release[''].sendTransaction({from: beneficiary1});

        let beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);
        let div21BeneficiaryBalance = beneficiary1_balance.dividedBy(21);

        div21BeneficiaryBalance = div21BeneficiaryBalance.mul(3);

        div21BeneficiaryBalance.should.be.bignumber.equal(beneficiary1Balance);
    });

    it('should release all token after vault end ', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        const days = 30*24;
        const endTime = VAULT_START_TIME + (days * 24 * 60 * 60);

        await increaseTimeTo(endTime);
        
        await pgoMonthlyInternalVaultInstance.release.sendTransaction(beneficiary1);

        const beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);

        beneficiary1_balance.should.be.bignumber.equal(beneficiary1Balance);
    });
});
