// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PolicyVerifier
 * @notice Enable ZERO-GAS policy validation using signed claims.
 * @dev Intended to be called via eth_call by middleware or SDK. 
 *      Uses EIP-191 signatures to verify that an agent has authorized a payment 
 *      constraints off-chain, which can then be verified on-chain if needed.
 */
contract PolicyVerifier {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // -------------------------------------------------------------------------
    // Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Verify that a policy claim was signed by the agent.
     * @param agent The address of the agent wallet (signer).
     * @param merchantId The ID of the merchant being paid.
     * @param maxAmount The maximum amount authorized for this session/claim.
     * @param validUntil The timestamp until which this claim is valid.
     * @param signature The EIP-191 signature produced by the agent.
     * @return isValid True if the signature recovers to the agent address and claim is unexpired.
     */
    function verifyPolicyClaim(
        address agent,
        string calldata merchantId,
        uint256 maxAmount,
        uint256 validUntil,
        bytes calldata signature
    ) external view returns (bool isValid) {
        // 1. Expiry Check (Critical Security Upgrade)
        if (block.timestamp > validUntil) {
            return false;
        }

        // 2. Reconstruct the message hash that was signed
        // Switched to abi.encode for collision safety (canonical encoding)
        // instead of abi.encodePacked.
        
        bytes32 messageHash = keccak256(
            abi.encode(
                agent,
                keccak256(bytes(merchantId)), // Hash dynamic strings inside struct logic
                maxAmount,
                validUntil
            )
        );

        // 3. Convert to EIP-191 Signed Message Hash
        // \x19Ethereum Signed Message:\n32 + hash
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // 4. Recover the signer
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, signature);

        // 5. Verify
        return recoveredSigner == agent;
    }
}
