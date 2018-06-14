/**
 * @title GotCrowdSale
 *
 * @version 1.0
 * @author ParkinGo
 */
pragma solidity ^0.4.24;

import "../../node_modules/openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "../../node_modules/openzeppelin-solidity/contracts/ownership/CanReclaimToken.sol";

import "./KYCBase.sol";
import "./ICOEngineInterface.sol";
import "./PGOVault.sol";
import "./GotToken.sol";
import "./PGOMonthlyInternalVault.sol";
import "./PGOMonthlyPresaleVault.sol";


contract GotCrowdSale is Pausable, CanReclaimToken, ICOEngineInterface, KYCBase {
    /*** CONSTANTS ***/
    uint256 public constant START_TIME = 1529406000;                     // 19 June 2018 11:00:00 GMT
    uint256 public constant END_TIME = 1530010800;                       // 26 June 2018 11:00:00 GMT
    uint256 public constant USD_PER_TOKEN = 75;                          // 0.75$
    uint256 public constant USD_PER_ETHER = 60000;                       // REMEMBER TO CHANGE IT AT ICO START

    //Token allocation
    //Team, founder, partners and advisor cap locked using Monthly Internal Vault
    uint256 public constant MONTHLY_INTERNAL_VAULT_CAP = 2.85e7 * 1e18;
    //Company unlocked liquidity and Airdrop allocation
    uint256 public constant PGO_UNLOCKED_LIQUIDITY_CAP = 1.5e7 * 1e18;
    //Internal reserve fund
    uint256 public constant PGO_INTERNAL_RESERVE_CAP = 3.5e7 * 1e18;
    //Reserved Presale Allocation 33% free and 67% locked using Monthly Presale Vault
    uint256 public constant RESERVED_PRESALE_CAP = 1.5683388e7 * 1e18;

    //ICO TOKEN ALLOCATION
    //Public ICO Cap
    //uint256 public constant CROWDSALE_CAP = 0.15e7 * 1e18;
    //Reservation contract Cap
    uint256 public constant RESERVATION_CAP = 0.4316612e7 * 1e18;
    //TOTAL ICO CAP
    uint256 public constant TOTAL_ICO_CAP = 0.5816612e7 * 1e18;

    uint256 public start;                                             // ICOEngineInterface
    uint256 public end;                                               // ICOEngineInterface
    uint256 public cap;                                               // ICOEngineInterface
    uint256 public tokenPerEth;
    uint256 public availableTokens;                                   // ICOEngineInterface
    address[] public kycSigners;                                      // KYCBase
    bool public capReached;
    uint256 public weiRaised;
    uint256 public tokensSold;

    // Vesting contracts.
    //Unlock funds after 9 months monthly
    PGOMonthlyInternalVault public pgoMonthlyInternalVault;
    //Unlock 1/3 funds immediately and remaining after 9 months monthly
    PGOMonthlyPresaleVault public pgoMonthlyPresaleVault;
    //Unlock funds after 12 months 25% every 6 months
    PGOVault public pgoVault;

    // Vesting wallets.
    address public pgoInternalReserveWallet;
    //Unlocked wallets
    address public pgoUnlockedLiquidityWallet;
    //ether wallet
    address public wallet;

    GotToken public token;

    // Lets owner manually end crowdsale.
    bool public didOwnerEndCrowdsale;

    /**
     * @dev Constructor.
     * @param _token address contract got tokens.
     * @param _wallet The address where funds should be transferred.
     * @param _pgoInternalReserveWallet The address where token will be send after vesting should be transferred.
     * @param _pgoUnlockedLiquidityWallet The address where token will be send after vesting should be transferred.
     * @param _pgoMonthlyInternalVault The address of internal funds vault contract with monthly unlocking after 9 months.
     * @param _pgoMonthlyPresaleVault The address of presale funds vault contract with 1/3 free funds and monthly unlocking after 9 months.
     * @param _kycSigners Array of the signers addresses required by the KYCBase constructor, provided by Eidoo.
     * See https://github.com/eidoo/icoengine
     */
    constructor(
        address _token,
        address _wallet,
        address _pgoInternalReserveWallet,
        address _pgoUnlockedLiquidityWallet,
        address _pgoMonthlyInternalVault,
        address _pgoMonthlyPresaleVault,
        address[] _kycSigners
    )
        public
        KYCBase(_kycSigners)
    {
        require(END_TIME >= START_TIME);
        require(TOTAL_ICO_CAP > 0);

        start = START_TIME;
        end = END_TIME;
        cap = TOTAL_ICO_CAP;
        wallet = _wallet;
        tokenPerEth = USD_PER_ETHER.div(USD_PER_TOKEN);
        availableTokens = TOTAL_ICO_CAP;
        kycSigners = _kycSigners;

        token = GotToken(_token);
        pgoMonthlyInternalVault = PGOMonthlyInternalVault(_pgoMonthlyInternalVault);
        pgoMonthlyPresaleVault = PGOMonthlyPresaleVault(_pgoMonthlyPresaleVault);
        pgoInternalReserveWallet = _pgoInternalReserveWallet;
        pgoUnlockedLiquidityWallet = _pgoUnlockedLiquidityWallet;
        wallet = _wallet;
        // Creates ParkinGo vault contract
        pgoVault = new PGOVault(pgoInternalReserveWallet, address(token), END_TIME);
    }

    /**
     * @dev Mints unlocked tokens to unlockedLiquidityWallet and
     * assings tokens to be held into the internal reserve vault contracts.
     * To be called by the crowdsale's owner only.
     */
    function mintPreAllocatedTokens() public onlyOwner {
        mintTokens(pgoUnlockedLiquidityWallet, PGO_UNLOCKED_LIQUIDITY_CAP);
        mintTokens(address(pgoVault), PGO_INTERNAL_RESERVE_CAP);
    }

    /**
     * @dev Sets the state of the internal monthly locked vault contract and mints tokens.
     * It will contains all TEAM, FOUNDER, ADVISOR and PARTNERS tokens.
     * All token are locked for the first 9 months and then unlocked monthly.
     * It will check that all internal token are correctly allocated.
     * So far, the internal monthly vault contract has been deployed and this function
     * needs to be called to set its investments and vesting conditions.
     * @param beneficiaries Array of the internal addresses to whom vested tokens are transferred.
     * @param balances Array of token amount per beneficiary.
     */
    function initPGOMonthlyInternalVault(address[] beneficiaries, uint256[] balances)
        public
        onlyOwner
        equalLength(beneficiaries, balances)
    {
        uint256 totalInternalBalance = 0;
        uint256 balancesLength = balances.length;

        for (uint256 i = 0; i < balancesLength; i++) {
            totalInternalBalance = totalInternalBalance.add(balances[i]);
        }
        //check that all balances matches internal vault allocated Cap
        require(totalInternalBalance == MONTHLY_INTERNAL_VAULT_CAP);

        pgoMonthlyInternalVault.init(beneficiaries, balances, END_TIME, token);

        mintTokens(address(pgoMonthlyInternalVault), MONTHLY_INTERNAL_VAULT_CAP);
    }

    /**
     * @dev Sets the state of the reserved presale vault contract and mints reserved presale tokens. 
     * It will contains all reserved PRESALE token,
     * 1/3 of tokens are free and the remaining are locked for the first 9 months and then unlocked monthly.
     * It will check that all reserved presale token are correctly allocated.
     * So far, the monthly presale vault contract has been deployed and
     * this function needs to be called to set its investments and vesting conditions.
     * @param beneficiaries Array of the presale investors addresses to whom vested tokens are transferred.
     * @param balances Array of token amount per beneficiary.
     */
    function initPGOMonthlyPresaleVault(address[] beneficiaries, uint256[] balances)
        public
        onlyOwner
        equalLength(beneficiaries, balances)
    {
        uint256 totalPresaleBalance = 0;
        uint256 balancesLength = balances.length;

        for (uint256 i = 0; i < balancesLength; i++) {
            totalPresaleBalance = totalPresaleBalance.add(balances[i]);
        }
        //check that all balances matches internal vault allocated Cap
        require(totalPresaleBalance == RESERVED_PRESALE_CAP);

        pgoMonthlyPresaleVault.init(beneficiaries, balances, END_TIME, token);

        mintTokens(address(pgoMonthlyPresaleVault), totalPresaleBalance);
    }

    /**
     * @dev Mint all token collected by second private presale (called reservation),
     * all KYC control are made outside contract under responsability of ParkinGO.
     * Also, updates tokensSold and availableTokens in the crowdsale contract,
     * it checks that sold token are less than reservation contract cap.
     * @param beneficiaries Array of the reservation user that bought tokens in private reservation sale.
     * @param balances Array of token amount per beneficiary.
     */
    function mintReservation(address[] beneficiaries, uint256[] balances)
        public
        onlyOwner
        equalLength(beneficiaries, balances)
    {
        require(tokensSold == 0);

        uint256 totalReservationBalance = 0;
        uint256 balancesLength = balances.length;

        for (uint256 i = 0; i < balancesLength; i++) {
            totalReservationBalance = totalReservationBalance.add(balances[i]);
            uint256 amount = balances[i];
            //update token sold of crowdsale contract
            tokensSold = tokensSold.add(amount);
            //update available token of crowdsale contract
            availableTokens = availableTokens.sub(amount);
            mintTokens(beneficiaries[i], amount);
        }

        require(totalReservationBalance <= RESERVATION_CAP);
    }

    /**
     * @dev Allows the owner to close the crowdsale manually before the end time.
     */
    function closeCrowdsale() public onlyOwner {
        require(block.timestamp >= START_TIME && block.timestamp < END_TIME);
        didOwnerEndCrowdsale = true;
    }

    /**
     * @dev Allows the owner to unpause tokens, stop minting and transfer ownership of the token contract.
     */
    function finalise() public onlyOwner {
        require(didOwnerEndCrowdsale || block.timestamp > end || capReached);

        token.finishMinting();
        token.unpause();

        // Token contract extends CanReclaimToken so the owner can recover
        // any ERC20 token received in this contract by mistake.
        // So far, the owner of the token contract is the crowdsale contract.
        // We transfer the ownership so the owner of the crowdsale is also the owner of the token.
        token.transferOwnership(owner);
    }

    /**
     * @dev Implements the price function from EidooEngineInterface.
     * @notice Calculates the price as tokens/ether based on the corresponding bonus bracket.
     * @return Price as tokens/ether.
     */
    function price() public view returns (uint256 _price) {
        return tokenPerEth;
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return False if the ico is not started, true if the ico is started and running, true if the ico is completed.
     */
    function started() public view returns(bool) {
        if (block.timestamp >= start) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return False if the ico is not started, false if the ico is started and running, true if the ico is completed.
     */
    function ended() public view returns(bool) {
        if (block.timestamp >= end) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return Timestamp of the ico start time.
     */
    function startTime() public view returns(uint) {
        return start;
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return Timestamp of the ico end time.
     */
    function endTime() public view returns(uint) {
        return end;
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return The total number of the tokens available for the sale, must not change when the ico is started.
     */
    function totalTokens() public view returns(uint) {
        return cap;
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return The number of the tokens available for the ico.
     * At the moment the ico starts it must be equal to totalTokens(),
     * then it will decrease.
     */
    function remainingTokens() public view returns(uint) {
        return availableTokens;
    }

    /**
     * @dev Implements the KYCBase senderAllowedFor function to enable a sender to buy tokens for a different address.
     * @return true.
     */
    function senderAllowedFor(address buyer) internal view returns(bool) {
        require(buyer != address(0));

        return true;
    }

    /**
     * @dev Implements the KYCBase releaseTokensTo function to mint tokens for an investor.
     * Called after the KYC process has passed.
     * @return A boolean that indicates if the operation was successful.
     */
    function releaseTokensTo(address buyer) internal returns(bool) {
        require(validPurchase());

        uint256 overflowTokens;
        uint256 refundWeiAmount;

        uint256 weiAmount = msg.value;
        uint256 tokenAmount = weiAmount.mul(price());

        if (tokenAmount >= availableTokens) {
            capReached = true;
            overflowTokens = tokenAmount.sub(availableTokens);
            tokenAmount = tokenAmount.sub(overflowTokens);
            refundWeiAmount = overflowTokens.div(price());
            weiAmount = weiAmount.sub(refundWeiAmount);
            buyer.transfer(refundWeiAmount);
        }

        weiRaised = weiRaised.add(weiAmount);
        tokensSold = tokensSold.add(tokenAmount);
        availableTokens = availableTokens.sub(tokenAmount);
        mintTokens(buyer, tokenAmount);
        forwardFunds(weiAmount);

        return true;
    }

    /**
     * @dev Fired by the releaseTokensTo function after minting tokens,
     * to forward the raised wei to the address that collects funds.
     * @param _weiAmount Amount of wei send by the investor.
     */
    function forwardFunds(uint256 _weiAmount) internal {
        wallet.transfer(_weiAmount);
    }

    /**
     * @dev Validates an incoming purchase. Required statements revert state when conditions are not met.
     * @return true If the transaction can buy tokens.
     */
    function validPurchase() internal view returns (bool) {
        require(!paused && !capReached);
        require(block.timestamp >= start && block.timestamp <= end);

        return true;
    }

    /**
     * @dev Mints tokens being sold during the crowdsale phase as part of the implementation of releaseTokensTo function
     * from the KYCBase contract.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mintTokens(address to, uint256 amount) private {
        token.mint(to, amount);
    }

    modifier equalLength(address[] beneficiaries, uint256[] balances) {
        require(beneficiaries.length == balances.length);
        _;
    }
}

