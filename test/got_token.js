import {expectThrow, BigNumber} from './helpers/tools';
import {logger} from "./helpers/logger";

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const GotToken = artifacts.require('GotToken');

contract('GotToken',(accounts) => {
    const tokenHolder1 = accounts[1];
    const tokenHolder2 = accounts[2];

    // Provide gotTokenInstance for every test case
    let gotTokenInstance;
    beforeEach(async () => {
        gotTokenInstance = await GotToken.deployed();
    });

    it('should instantiate the ICO token correctly', async () => {
        const name = await gotTokenInstance.name();
        const symbol = await gotTokenInstance.symbol();
        const decimals = await gotTokenInstance.decimals();

        logger.info(accounts[0]);
        logger.info(accounts[1]);

        name.should.equal('GOToken');
        symbol.should.equal('GOT');
        decimals.should.be.bignumber.equal(18, 'Decimals does not match');
    });

    it('should fail, token can not be transferrable while on paused mode', async () => {
        await expectThrow(gotTokenInstance.transfer(tokenHolder2, 1, {from: tokenHolder1}));

        const balanceTokenHolder2 = await gotTokenInstance.balanceOf(tokenHolder2);
        balanceTokenHolder2.should.be.bignumber.equal(0);
    });

   
});
