// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockVault is ERC20 {
    IERC20 public underlying;
    uint256 public exchangeRateStored = 200000000; // 0.02 (8 decimals vs 18?) Tectonic uses crazy mantissas.
    // Let's simluate simple 1:1 for now

    constructor(address _underlying) ERC20("Mock Tectonic", "tUSDC") {
        underlying = IERC20(_underlying);
    }

    function mint(uint256 mintAmount) external returns (uint256) {
        // Transfer USDC from user to here
        bool success = underlying.transferFrom(msg.sender, address(this), mintAmount);
        require(success, "Transfer failed");
        
        // Mint tTokens
        _mint(msg.sender, mintAmount * 50); // 1 USDC = 50 tUSDC
        return 0; // 0 = Success in Compound/Tectonic
    }
    
    // Tectonic specific
    function supplyRatePerBlock() external pure returns (uint256) {
        return 1000000000; // Fake rate
    }
}
