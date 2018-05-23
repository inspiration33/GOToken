/**
 * @title PGOVault
 * @dev A token holder contract that allows the release of tokens to the UbiatarPlay Wallet.
 *
 * @version 1.0
 * @author Validity Labs AG <info@validitylabs.org>
 */

pragma solidity ^0.4.19;

import "../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../node_modules/openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

import "./GotCrowdSale.sol";
import "./GotToken.sol";

contract PGOVault {
    using SafeMath for uint256;
    using SafeERC20 for GotToken;

    uint256[4] public vesting_offsets = [
        336 days,
        504 days,
        672 days,
        840 days
    ];

    uint256[4] public vesting_amounts = [
        8.75e6 * 1e18,
        8.75e6 * 1e18,
        8.75e6 * 1e18,
        8.75e6 * 1e18
    ];

    address public pgoWallet;
    GotToken public token;
    uint256 public start;
    uint256 public released;

    /**
     * @dev Constructor.
     * @param _pgoWallet The address that will receive the vested tokens.
     * @param _token The GOT Token, which is being vested.
     * @param _start The start time from which each release time will be calculated.
     */
    function PGOVault(
        address _pgoWallet,
        address _token,
        uint256 _start
    )
        public
    {
        pgoWallet = _pgoWallet;
        token = GotToken(_token);
        start = _start;
    }

    /**
     * @dev Transfers vested tokens to ubiatarPlayWallet.
     */
    function release() public {
        uint256 unreleased = releasableAmount();
        require(unreleased > 0);

        released = released.add(unreleased);

        token.safeTransfer(pgoWallet, unreleased);
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     */
    function releasableAmount() public view returns (uint256) {
        return vestedAmount().sub(released);
    }

    /**
     * @dev Calculates the amount that has already vested.
     */
    function vestedAmount() public view returns (uint256) {
        uint256 vested = 0;
        for (uint256 i = 0; i < vesting_offsets.length; i = i.add(1)) {
            if (block.timestamp > start.add(vesting_offsets[i])) {
                vested = vested.add(vesting_amounts[i]);
            }
        }
        return vested;
    }

    /**
     * @dev Calculates the amount that has not yet released.
     */
    function unreleasedAmount() public view returns (uint256) {
        uint256 unreleased = 0;
        for (uint256 i = 0; i < vesting_offsets.length; i = i.add(1)) {
            unreleased = unreleased.add(vesting_amounts[i]);
        }
        return unreleased.sub(released);
    }
}


