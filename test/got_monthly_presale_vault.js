import {waitNDays, BigNumber, increaseTimeTo} from './helpers/tools';
import {logger as log} from "./helpers/logger";

const GotCrowdSale = artifacts.require('./GotCrowdSale.sol');
const PGOMonthlyPresaleVault = artifacts.require('./PGOMonthlyPresaleVault.sol');
const GotToken = artifacts.require('./GotToken.sol');

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const VAULT_START_TIME = 1530010801;      // 26 June 2018 11:00:00 GMT

contract('PGOMonthlyPresaleVault',(accounts) => {
    const beneficiary1 = accounts[5];
    const beneficiary1_balance = new BigNumber(1.5702889e7 * 1e18);

    // Provide gotTokenInstance for every test case
    let gotCrowdSaleInstance;
    let gotTokenAddress;
    let gotTokenInstance;
    let pgoMonthlyPresaleVaultInstance;

    beforeEach(async () => {
        gotCrowdSaleInstance = await GotCrowdSale.deployed();
        gotTokenAddress = await gotCrowdSaleInstance.token();
        gotTokenInstance = await GotToken.at(gotTokenAddress);
        pgoMonthlyPresaleVaultInstance = await PGOMonthlyPresaleVault.deployed();
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

    it('should increase time to ICO END', async () => {
        log.info('[ ICO END TIME ]');
        await increaseTimeTo(VAULT_START_TIME);

        let isICOEnded = await gotCrowdSaleInstance.ended();
        assert.isTrue(isICOEnded);
        await gotCrowdSaleInstance.finalise();
        isICOEnded = await gotCrowdSaleInstance.ended();
        assert.isTrue(isICOEnded);
        log.info('[ Finalized ]');
    });

    it('should check unlocked tokens before 3 months are 1/3', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        let beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);
        let vaultBalance = await gotTokenInstance.balanceOf(pgoMonthlyPresaleVaultInstance.address);

        beneficiary1Balance.should.be.bignumber.equal(0);
        vaultBalance.should.be.bignumber.equal(beneficiary1_balance);

        const vested = await pgoMonthlyPresaleVaultInstance.vestedAmount(beneficiary1);
        vested.should.be.bignumber.equal(beneficiary1_balance.div(3));

        let releasable = await pgoMonthlyPresaleVaultInstance.releasableAmount(beneficiary1);
        releasable.should.be.bignumber.equal(beneficiary1_balance.div(3));

        await pgoMonthlyPresaleVaultInstance.release(beneficiary1);

        releasable = await pgoMonthlyPresaleVaultInstance.releasableAmount(beneficiary1);
        releasable.should.be.bignumber.equal(0);

        beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);
        vaultBalance = await gotTokenInstance.balanceOf(pgoMonthlyPresaleVaultInstance.address);

        beneficiary1Balance.should.be.bignumber.equal(beneficiary1_balance.div(3));
        vaultBalance.should.be.bignumber.equal(beneficiary1_balance.sub(beneficiary1_balance.div(3)));
    });

    it('should check 1/21 of token are unlocked after 4 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(120);
        await pgoMonthlyPresaleVaultInstance.release(beneficiary1);

        const beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);

        log.info(beneficiary1Balance);

        const div21BeneficiaryBalance = beneficiary1_balance.mul(2).div(3).div(21);
        const initial33percentBalance = beneficiary1_balance.div(3);

        beneficiary1Balance.should.be.bignumber.equal(div21BeneficiaryBalance.add(initial33percentBalance));
    });

    it('should check 2/21 of token are unlocked after 5 months', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(30);
        await pgoMonthlyPresaleVaultInstance.release(beneficiary1);

        let beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);

        log.info(beneficiary1Balance);

        let div21BeneficiaryBalance = beneficiary1_balance.mul(2).div(3).div(21);
        div21BeneficiaryBalance = div21BeneficiaryBalance.mul(2);
        const initial33percentBalance = beneficiary1_balance.div(3);

        beneficiary1Balance.should.be.bignumber.equal(div21BeneficiaryBalance.add(initial33percentBalance));
    });

    it('should check 3/21 of token are unlocked after 6 months by calling .release() from an external address', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        await waitNDays(30);
        await pgoMonthlyPresaleVaultInstance.contract.release['']({from: beneficiary1});

        let beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);

        let div21BeneficiaryBalance = beneficiary1_balance.mul(2).div(3).div(21);
        div21BeneficiaryBalance = div21BeneficiaryBalance.mul(3);
        const initial33percentBalance = beneficiary1_balance.div(3);

        beneficiary1Balance.should.be.bignumber.equal(div21BeneficiaryBalance.add(initial33percentBalance));
    });

    it('should release all token after vault end ', async () => {
        BigNumber.config({DECIMAL_PLACES:0});

        const days = 30*24;
        const endTime = VAULT_START_TIME + (days * 24 * 60 * 60);

        await increaseTimeTo(endTime);

        await pgoMonthlyPresaleVaultInstance.release(beneficiary1);

        const beneficiary1Balance = await gotTokenInstance.balanceOf(beneficiary1);

        beneficiary1Balance.should.be.bignumber.equal(beneficiary1_balance);
    });
});
