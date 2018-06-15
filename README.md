# GOToken

## Deployment
1. Deploy GotToken and note the address
2. Deploy Internal Monthly Vault
3. Deploy Presale Monthly Vault
4. Deploy GotCrowdSale and pass the addresses of token, wallet addresses , internal and presale token vault addresses (and further parameters as per constructor definition)
5. Transfer ownership of the token to the crowdsale by calling `gotTokenInstance.transferOwnership(gotCrowdsaleAddress)`
6. Call the function in the crowdsale that mints the pre-allocated locked and unlocked liquidity funds `gotCrowdsaleInstance.mintPreAllocatedTokens()`
7. Set the tokens for founders, advisors, teams and partners investments in the crowdsale by calling `gotCrowdSaleInstance.initPGOMonthlyInternalVault(beneficiaries, balances)`
8. Set the tokens for private presales in the crowdsale by calling `gotCrowdSaleInstance.initPGOMonthlyPresaleVault(beneficiaries, balances)`
9. Call the function in the crowdsale that mints the reservation phase in the crowdsale by calling `gotCrowdSaleInstance.mintReservation(beneficiaries, balances)`

## During the Crowdsale phase
###### Callable by the owner only:
* Pause/unpause the sales in case of an emergency:
    - `gotCrowdSaleInstance.pause()`, `gotCrowdSaleInstance.unpause()`

  **Note that no tokens can be minted when paused**.
* Recover ERC20 tokens sent by mistake to the GotToken and GotCrowdSaleCrowdsale contracts:
    - `gotTokenInstance.reclaimToken(token)`
    - `gotCrowdSaleInstance.reclaimToken(token)`

  The balance would be sent to the contract's owner. Then, the owner can transfer the recovered tokens to their respective owner.
* Close the crowdsale manually before the end time:
    - `gotCrowdSaleInstance.closeCrowdsale()`
* Finalise the crowdsale to make the tokens transferable, when the owner has closed the crowdsale or the max cap or end time has been reached:
    - `gotCrowdSaleInstance.finalise()`

  The ownership of the GotToken contract will be transferred to the Crowdsale contract's owner.

###### Reservation phase
* The Reservation phase is intended to start off-chain by accounting the addresses of the investors and their reserved GOTokens.
* The reserved tokens will be distributed at the start of the ICO phase via the function `gotCrowdSaleInstance.mintReservation(beneficiary, balances)` in the `GotCrowdSale.sol` contract.

## Vesting phases
* Presale investor can claim the vested tokens by calling `pgoMonthlyPresaleVault.release()`.  
Tokens can be transferred by a sender to the beneficiary's address, when calling `pgoMonthlyPresaleVault.release(beneficiary)`
* Founders, advisors, teams and partners can claim the vested tokens by calling `pgoMonthlyInternalVault.release()`.  
Tokens can be transferred by a sender to the beneficiary's address, when calling `pgoMonthlyInternalVault.release(beneficiary)`
* Transfer internal liquidity vested tokens to the pgoLockedLiquidityWallet by calling `pgoVault.release()`

## Specifications
###### Token
* Basic ERC20 token features.
* Mintable (by corresponding crowdsale contract only).
* Pausable by owner.
* Name: “GOToken”.
* Symbol: “GOT”.
* Decimals: 18.
* Reclaimable token: allows the owner to recover any ERC20 token received. During the crowdsale period, the owner of the token is the crowdsale contract, therefore, it is convenient to reclaim tokens after the crowdsale has ended.

###### Crowdsale
* Start time: Epoch timestamp: 1529406000 (19 June 2018 11:00:00 GMT).
* End time: Epoch timestamp: 1530003600 (26 June 2018 11:00:00 GMT).
* Price: USD 0.75 per token.
* Soft Cap: 2.000.000 USD.
* Hard cap: 12.000.000 USD.
* Pausable: owner is able to pause (and unpause) the crowdsale phase.
* Reclaimable token: allows the owner to recover any ERC20 token received.
* Paused until ICO end epoch time.
* It should be possible to buy tokens for a specific address.
* Controlled: once the ICO has finished, it may not be possible to arbitrarily issue new
tokens.
* Tokens issued simultaneously with the reception of ether.
* Implements Eidoo interface:
https://github.com/eidoo/icoengine/blob/master/contracts/ICOEngineInterface.sol
* KYC implementation, based on
https://github.com/eidoo/icoengine/blob/master/contracts/KYCBase.sol

###### Token allocation
* Internal Reserve fund
    * Mentioned as PGO Vault in the code.
    * 35.000.000 tokens.
    * ¼ tokens unlocked 360 days after the end of ICO.
    * remaining ¾ unlocked 540, 720 and 900 days after the end of ICO.
    
* Unlocked liquidity
    * 15.000.000 tokens.
    * Can be used for bounty programs and airdrop.

* Founders
    * 10.000.000 tokens assigned to a unique wallet address.
    * Continuous vesting: starts 3 months after the end of ICO and ends 21 months
    later.

* Advisors
    * List of Advisors wallet with GOT amount.
    * 5.000.000 tokens.
    * Continuous vesting: starts 3 months after the end of ICO and ends 21 months
    later.

* Partners Pre-sale
    * Already finished.
    * List of Presale investors wallet with GOT amount.
    * 13.500.000 tokens.
    * Continuous vesting: starts 3 months after the end of ICO and ends 21 months
    later.

* Reserved Pre-sale
    * Already finished.
    * List of Presale investors wallet with GOT amount.
    * 15.702.889 tokens.
    * 1⁄3 tokens unlocked right after the end of ICO.
    * Continuous vesting of remaining 2⁄3 tokens: starts 3 months after the end of ICO
    and ends 21 months later.
    * 60% Discount
    * 1 token = 0.30 usd

* Reservation phase
    * 4.297.111 tokens.
    * 5%, 10% or 20% discount, depending on discount code applied.
    * 10% and 20% only with private invitation.
    * Require previous KYC verification.

* Public ICO
    * 1.500.000 tokens plus all not sold during Reservation phase.
    * 1 Token = 0.75 usd.


## Requirements
The server side scripts requires NodeJS 8 to work properly.
Go to [NVM](https://github.com/creationix/nvm) and follow the installation description.
By running `source ./tools/initShell.sh`, the correct NodeJs version will be activated for the current shell.

NVM supports both Linux and OS X, but that’s not to say that Windows users have to miss out. There is a second project named [nvm-windows](https://github.com/coreybutler/nvm-windows) which offers Windows users the possibility of easily managing Node environments.

__nvmrc support for windows users is not given, please make sure you are using the right Node version (as defined in .nvmrc) for this project!__

For the Rinkeby and MainNet deployment, you need Geth on your machine.
Follow the [installation instructions](https://github.com/ethereum/go-ethereum/wiki/Building-Ethereum) for your OS.

Depending on your system, the following components might be already available or have to be provided manually:
* [Python](https://www.python.org/downloads/windows/) 2.7 Version only! Windows users should put python into the PATH by cheking the mark in installation process. The windows build tools contain python, so you don't have to install this manually.
* GIT, should be already installed on *nix systems. Windows users have to install [GIT](http://git-scm.com/download/win) manually.
* On Windows systems, PowerShell is mandatory
* On Windows systems, windows build tools are required (npm install --global windows-build-tools)
* make (on Ubuntu this is part of the commonly installed `sudo apt-get install build-essential`)
* On OSX, the build tools included in XCode are required

## General
Before running the provided scripts, you have to initialize your current terminal via `source ./tools/initShell.sh` for every terminal in use. This will add the current directory to the system PATH variables and must be repeated for time you start a new terminal window from project base directory. Windows users with installed PoserShell should use the script `. .\tools\initShell.ps1` instead.
```
# *nix
cd <project base directory>
source ./tools/initShell.sh

# Win
cd <project base directory>
. .\tools\initShell.ps1
```

__Every command must be executed from within the projects base directory!__

## Setup
Open your terminal and change into your project base directory. From here, install all needed dependencies.
```
npm install
```
This will install all required dependecies in the directory _node_modules_.

## Compile, migrate, test and coverage
To compile, deploy and test the smart contracts, go into the projects root directory and use the task runner accordingly.
```

# Compile flattened contract
npm run-script build

# Compile contract
truffle compile

# Migrate contract
truffle migrate

# Test the contract
ganache-cli --defaultBalanceEther 8000000 --port 7545
truffle test `./test/testfilename`
```

### Contract Verification
The final step for the Rinkeby / MainNet deployment is the contract verificationSmart contract verification.

This can be done on [Etherscan](https://etherscan.io/address/<REAL_ADDRESS_HERE>) or [Rinkeby Etherscan](https://rinkeby.etherscan.io/address/<REAL_ADDRESS_HERE>).
- Click on the `Contract Creation` link in the `to` column
- Click on the `Contract Code` link

Fill in the following data.
```
Contract Address:       <CONTRACT_ADDRESS>
Contract Name:          <CONTRACT_NAME>
Compiler:               0.4.24+commit.e67f0147
Optimization:           YES
Solidity Contract Code: <Copy & Paste from ./build/bundle/GotCrowdSale_all.sol>
Constructor Arguments:  <ABI from deployment output>
```
Visit [Solc version number](https://github.com/ethereum/solc-bin/tree/gh-pages/bin) page for determining the correct version number for your project.

- Confirm you are not a robot
- Hit `verify and publish` button

Now your smart contract is verified.