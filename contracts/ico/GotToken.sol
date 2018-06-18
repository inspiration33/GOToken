/**
 * @title ParkinGO token
 *
 * @version 1.0
 * @author ParkinGO
 */
pragma solidity ^0.4.24;

import "../../node_modules/openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "../../node_modules/openzeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "../../node_modules/openzeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "../../node_modules/openzeppelin-solidity/contracts/ownership/CanReclaimToken.sol";


contract GotToken is CanReclaimToken, MintableToken, PausableToken, BurnableToken {
    string public constant name = "GOToken";
    string public constant symbol = "GOT";
    uint8 public constant decimals = 18;

    /**
     * @dev Constructor of GotToken that instantiates a new Mintable Pausable Token
     */
    constructor() public {
        // token should not be transferable until after all tokens have been issued
        paused = true;
    }
}

