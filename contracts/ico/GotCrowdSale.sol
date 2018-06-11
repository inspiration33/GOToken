/**
 * @title GotCrowdSale
 *
 * @version 1.0
 * @author ParkinGo
 */
pragma solidity ^0.4.19;

import "./CrowdsaleBase.sol";
import "./PGOVault.sol";
import "./GotToken.sol";
import "./PGOMonthlyInternalVault.sol";
import "./PGOMonthlyPresaleVault.sol";


contract GotCrowdSale is CrowdsaleBase {
    /*** CONSTANTS ***/
    uint256 public constant START_TIME = 1528794000;                     // 12 June 2018 09:00:00 GMT
    uint256 public constant END_TIME = 1530003600;                       // 26 June 2018 09:00:00 GMT

    //Token allocation
    //Team, founder, partners and advisor cap locked using Monthly Internal Vault
    uint256 public constant MONTHLY_INTERNAL_VAULT_CAP = 2.5e7 * 1e18;
    //Company unlocked liquidity and Airdrop allocation
    uint256 public constant PGO_UNLOCKED_LIQUIDITY_CAP = 1.5e7 * 1e18;
    //Locked company liquidity
    uint256 public constant PGO_LOCKED_LIQUIDITY_CAP = 3.5e7 * 1e18;
    //Reserved Presale Allocation  33% free and 67% locked using Monthly Presale Vault
    uint256 public constant RESERVED_PRESALE_CAP = 1.35e7 * 1e18;

    //ICO TOKEN ALLOCATION
    //Public ICO Cap 
    //uint256 public constant CROWDSALE_CAP = 0.275e7 * 1e18;
    //Reservation contract Cap
    uint256 public constant RESERVATION_CAP = 0.875e7 * 1e18;
    //TOTAL ICO CAP
    uint256 public constant TOTAL_MAX_CAP = 1.15e7 * 1e18;

    // Vesting contracts.
    //Unlock funds after 9 months monthly
    PGOMonthlyInternalVault public pgoMonthlyInternalVault;
    //Unlock 1/3 funds immediately and remaining after 9 months monthly
    PGOMonthlyPresaleVault public pgoMonthlyPresaleVault;
    //Unlock funds after 12 months 25% every 6 months
    PGOVault public pgoVault;

    // Vesting wallets.
    address public pgoLockedLiquidityWallet;
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
     * @param _pgoLockedLiquidityWallet The address where token will be send after vesting should be transferred.
     * @param _pgoUnlockedLiquidityWallet The address where token will be send after vesting should be transferred.
     * @param _pgoMonthlyInternalVault The address of internal funds vault contract with monthly unlocking after 9 months.
     * @param _pgoMonthlyPresaleVault The address of presale funds vault contract with 1/3 free funds and monthly unlocking after 9 months.
     * @param _kycSigners Array of the signers addresses required by the KYCBase constructor, provided by Eidoo.
     * See https://github.com/eidoo/icoengine
     */
    function GotCrowdSale(
        address _token,
        address _wallet,
        address _pgoLockedLiquidityWallet,
        address _pgoUnlockedLiquidityWallet,
        address _pgoMonthlyInternalVault,
        address _pgoMonthlyPresaleVault,
        address[] _kycSigners
    )
        public
        CrowdsaleBase(START_TIME, END_TIME, TOTAL_MAX_CAP, _wallet, _kycSigners)
    {
        token = GotToken(_token);
        pgoMonthlyInternalVault = PGOMonthlyInternalVault(_pgoMonthlyInternalVault);
        pgoMonthlyPresaleVault = PGOMonthlyPresaleVault(_pgoMonthlyPresaleVault);
        pgoLockedLiquidityWallet = _pgoLockedLiquidityWallet;
        pgoUnlockedLiquidityWallet = _pgoUnlockedLiquidityWallet;
        wallet = _wallet;
        // Creates ParkinGo vault contract
        pgoVault = new PGOVault(pgoLockedLiquidityWallet, address(token), END_TIME);
    }

    /**
     * @dev Mints unlocked tokens to unlockedLiquidityWallet and
     * assings tokens to be held into the locked liquidity vault contracts.
     * To be called by the crowdsale's owner only.
     */
    function mintPreAllocatedTokens() public onlyOwner {
        mintTokens(pgoUnlockedLiquidityWallet, PGO_UNLOCKED_LIQUIDITY_CAP);
        mintTokens(address(pgoVault), PGO_LOCKED_LIQUIDITY_CAP);
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
    function initPGOMonthlyInternalVault(address[] beneficiaries, uint256[] balances) public onlyOwner {
        require(beneficiaries.length == balances.length);
        uint256 totalInternalBalance = 0;
        uint256 balancesLength = balances.length;
        for(uint256 i = 0; i < balancesLength; i++) {
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
    function initPGOMonthlyPresaleVault(address[] beneficiaries, uint256[] balances) public onlyOwner {
        require(beneficiaries.length == balances.length);
        uint256 totalPresaleBalance = 0;
        uint256 balancesLength = balances.length;
        for(uint256 i = 0; i < balancesLength; i++) {
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
    function mintReservation(address[] beneficiaries, uint256[] balances) public onlyOwner {
        require(beneficiaries.length == balances.length);

        uint256 totalReservationBalance = 0;
        uint256 balancesLength = balances.length;

        for(uint256 i = 0; i < balancesLength; i++) {
            totalReservationBalance = totalReservationBalance.add(balances[i]);
        }

        require(totalReservationBalance <= RESERVATION_CAP);

        for(uint256 z = 0; z < balancesLength; z++) {
            uint256 amount = balances[z];
            //update token sold of crowdsale contract
            tokensSold = tokensSold.add(amount);
            //update available token of crowdsale contract
            availableTokens = availableTokens.sub(amount);
            mintTokens(beneficiaries[z], amount);
        }
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
     * @dev Mints tokens being sold during the crowdsale phase as part of the implementation of releaseTokensTo function
     * from the KYCBase contract.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mintTokens(address to, uint256 amount) private {
        token.mint(to, amount);
    }
}

