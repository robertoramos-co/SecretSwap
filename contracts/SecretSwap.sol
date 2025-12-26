// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SecretSwap
/// @notice Swap ETH for an encrypted USDT balance at a fixed rate (1 ETH = 2300 USDT).
/// @dev USDT is represented only as an encrypted balance stored on-chain.
contract SecretSwap is ZamaEthereumConfig {
    uint256 public constant USDT_DECIMALS = 6;
    uint256 public constant USDT_PER_ETH = 2300 * 10 ** USDT_DECIMALS;

    mapping(address => euint64) private _encryptedUsdtBalance;

    event Swapped(address indexed user, uint256 ethInWei, uint256 usdtOut);

    error ZeroEthInput();
    error QuoteTooLarge();

    /// @notice Returns the quoted USDT amount for a given ETH input (in wei).
    function quoteUsdt(uint256 ethInWei) public pure returns (uint256) {
        return (ethInWei * USDT_PER_ETH) / 1e18;
    }

    /// @notice Swaps the exact ETH sent for encrypted USDT balance.
    function swapExactETHForUSDT() external payable {
        if (msg.value == 0) revert ZeroEthInput();

        uint256 usdtOut = quoteUsdt(msg.value);
        if (usdtOut > type(uint64).max) revert QuoteTooLarge();

        euint64 encryptedOut = FHE.asEuint64(uint64(usdtOut));
        _encryptedUsdtBalance[msg.sender] = FHE.add(_encryptedUsdtBalance[msg.sender], encryptedOut);

        FHE.allowThis(_encryptedUsdtBalance[msg.sender]);
        FHE.allow(_encryptedUsdtBalance[msg.sender], msg.sender);

        emit Swapped(msg.sender, msg.value, usdtOut);
    }

    /// @notice Returns the encrypted USDT balance for `account`.
    /// @dev View functions must not rely on msg.sender for the target account.
    function encryptedBalanceOf(address account) external view returns (euint64) {
        return _encryptedUsdtBalance[account];
    }
}

