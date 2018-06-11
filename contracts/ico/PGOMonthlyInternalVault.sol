/**
 * @title PGOMonthlyVault
 * @dev A token holder contract that allows the release of tokens after a vesting period.
 *
 * @version 1.0
 * @author ParkinGO
 */

pragma solidity ^0.4.19;

import "../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../node_modules/openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

import "./GotToken.sol";


contract PGOMonthlyInternalVault {
    using SafeMath for uint256;
    using SafeERC20 for GotToken;

    struct Investment {
        address beneficiary;
        uint256 totalBalance;
        uint256 released;
    }

    /*** CONSTANTS ***/
    uint256 public constant VESTING_DIV_RATE = 21;                   // division rate of monthly vesting
    uint256 public constant VESTING_OFFSETS = 30 days;               // vesting interval
    uint256 public constant VESTING_CLIFF = 90 days;                // vesting interval
    uint256 public constant VESTING_DURATION = 720 days;            // vesting duration

    GotToken public token;
    uint256 public start;
    uint256 public end;
    uint256 public cliff;

    Investment[] public investments;

    // key: investor address; value: index in investments array.
    mapping(address => uint256) public investorLUT;

    /**
     * @dev Function to be fired by the initPGOMonthlyInternalVault function from the GotCrowdSale contract to set the
     * InternalVault's state after deployment.
     * @param beneficiaries Array of the internal investors addresses to whom vested tokens are transferred.
     * @param balances Array of token amount per beneficiary.
     * @param startTime Start time at which the first released will be executed, and from which the cliff for second
     * release is calculated.
     * @param _token The address of the GOT Token.
     */
    function init(address[] beneficiaries, uint256[] balances, uint256 startTime, address _token) public {
        // makes sure this function is only called once
        require(token == address(0));
        require(beneficiaries.length == balances.length);

        start = startTime;
        cliff = start.add(VESTING_CLIFF);
        end = start.add(VESTING_DURATION);

        token = GotToken(_token);

        for (uint256 i = 0; i < beneficiaries.length; i = i.add(1)) {
            investorLUT[beneficiaries[i]] = investments.length;
            investments.push(Investment(beneficiaries[i], balances[i], 0));
        }
    }

    /**
     * @dev Allows a sender to transfer vested tokens to the beneficiary's address.
     * @param beneficiary The address that will receive the vested tokens.
     */
    function release(address beneficiary) public {
        uint256 unreleased = releasableAmount(beneficiary);
        require(unreleased > 0);

        uint256 investmentIndex = investorLUT[beneficiary];
        investments[investmentIndex].released = investments[investmentIndex].released.add(unreleased);
        token.safeTransfer(beneficiary, unreleased);
    }

    /**
     * @dev Transfers vested tokens to the sender's address.
     */
    function release() public {
        release(msg.sender);
    }

    /**
     * @dev Allows to check an investment.
     * @param index The index of investment to check.
     */
    function getInvestment(uint index) public view returns(address, uint256, uint256) {
        return (investments[index].beneficiary,investments[index].totalBalance,investments[index].released);
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     * @param beneficiary The address that will receive the vested tokens.
     */
    function releasableAmount(address beneficiary) public view returns (uint256) {
        uint256 investmentIndex = investorLUT[beneficiary];

        return vestedAmount(beneficiary).sub(investments[investmentIndex].released);
    }

    /**
     * @dev Calculates the amount that has already vested.
     * @param beneficiary The address that will receive the vested tokens.
     */
    function vestedAmount(address beneficiary) public view returns (uint256) {
        uint256 investmentIndex = investorLUT[beneficiary];
        uint256 vested = 0;
        if (block.timestamp >= cliff && block.timestamp < end) {
            // after cliff -> 1/27 of totalBalance every month, must skip first 9 month 
            uint256 totalBalance = investments[investmentIndex].totalBalance;
            uint256 monthlyBalance = totalBalance.div(VESTING_DIV_RATE);
            uint256 daysToSkip = 90 days;
            uint256 time = block.timestamp.sub(start).sub(daysToSkip);
            uint256 elapsedOffsets = time.div(VESTING_OFFSETS);
            uint vestedToSum = elapsedOffsets.mul(monthlyBalance);
            vested = vested.add(vestedToSum);
        }
        if (block.timestamp >= end) {
            // after end -> all vested
            vested = investments[investmentIndex].totalBalance;
        }
        return vested;
    }
}

