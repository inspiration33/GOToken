/**
 * @title PGOMonthlyVault
 * @dev A token holder contract that allows the release of tokens after a vesting period.
 *
 * @version 1.0
 * @author ParkinGO
 */

pragma solidity ^0.4.24;

import "../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../node_modules/openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

import "./GotToken.sol";
import "./PGOMonthlyInternalVault.sol";


contract PGOMonthlyPresaleVault is PGOMonthlyInternalVault {
    /**
     * @dev OVERRIDE vestedAmount from PGOMonthlyInternalVault
     * Calculates the amount that has already vested, release 1/3 of token immediately.
     * @param beneficiary The address that will receive the vested tokens.
     */
    function vestedAmount(address beneficiary) public view returns (uint256) {
        uint256 vested = 0;

        if (block.timestamp >= start) {
            // after start -> 1/3 released (fixed)
            vested = investments[beneficiary].totalBalance.div(3);
        }
        if (block.timestamp >= cliff && block.timestamp < end) {
            // after cliff -> 1/27 of totalBalance every month, must skip first 9 month 
            uint256 unlockedStartBalance = investments[beneficiary].totalBalance.div(3);
            uint256 totalBalance = investments[beneficiary].totalBalance;
            uint256 lockedBalance = totalBalance.sub(unlockedStartBalance);
            uint256 monthlyBalance = lockedBalance.div(VESTING_DIV_RATE);
            uint256 daysToSkip = 90 days;
            uint256 time = block.timestamp.sub(start).sub(daysToSkip);
            uint256 elapsedOffsets = time.div(VESTING_INTERVAL);
            vested = vested.add(elapsedOffsets.mul(monthlyBalance));
        }
        if (block.timestamp >= end) {
            // after end -> all vested
            vested = investments[beneficiary].totalBalance;
        }
        return vested;
    }
}

