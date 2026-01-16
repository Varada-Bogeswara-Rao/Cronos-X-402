// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentPolicyRegistry
 * @notice Lightweight on-chain policy anchor for AI agent wallets.
 * @dev Stores policy configuration guarantees. Actual enforcement is off-chain (SDK/Middleware).
 *      No spending counters are tracked here to save gas.
 */
contract AgentPolicyRegistry {
    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Policy {
        uint256 dailySpendLimit;    // Reference value (e.g., 6 decimals for USDC)
        uint256 maxPerTransaction;  // Reference value
        bytes32 policyHash;         // Hash of the full off-chain JSON config
        uint256 lastUpdated;        // Timestamp
        bool isFrozen;              // Emergency stop flag
    }

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------

    /// @notice Maps agent wallet address to their on-chain policy
    mapping(address => Policy) private policies;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event PolicySet(
        address indexed agent,
        uint256 dailySpendLimit,
        uint256 maxPerTransaction,
        bytes32 policyHash,
        uint256 timestamp
    );

    event PolicyUpdated(
        address indexed agent,
        uint256 newDailyLimit,
        uint256 newMaxPerTx,
        bytes32 newPolicyHash,
        uint256 timestamp
    );

    event PolicyFrozen(
        address indexed agent,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error PolicyAlreadyFrozen();
    error InvalidPolicyParams();

    // -------------------------------------------------------------------------
    // Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Set or update the policy for the caller's wallet (the agent).
     * @param dailySpendLimit The daily limit reference value.
     * @param maxPerTransaction The per-transaction limit reference value.
     * @param policyHash The has of the detailed off-chain configuration.
     */
    function setPolicy(
        uint256 dailySpendLimit,
        uint256 maxPerTransaction,
        bytes32 policyHash
    ) external {
        // Validation: Logic constraints
        if (maxPerTransaction > dailySpendLimit || dailySpendLimit == 0) {
            revert InvalidPolicyParams();
        }

        Policy storage p = policies[msg.sender];
        bool isNew = p.lastUpdated == 0;

        p.dailySpendLimit = dailySpendLimit;
        p.maxPerTransaction = maxPerTransaction;
        p.policyHash = policyHash;
        p.lastUpdated = block.timestamp;
        p.isFrozen = false; // Reset freeze status on explicit update/reset.

        if (isNew) {
            emit PolicySet(msg.sender, dailySpendLimit, maxPerTransaction, policyHash, block.timestamp);
        } else {
            emit PolicyUpdated(msg.sender, dailySpendLimit, maxPerTransaction, policyHash, block.timestamp);
        }
    }

    /**
     * @notice Updates specific limits without changing the hash.
     * @param dailySpendLimit New daily limit.
     * @param maxPerTransaction New per-tx limit.
     */
    function updateLimits(uint256 dailySpendLimit, uint256 maxPerTransaction) external {
        if (maxPerTransaction > dailySpendLimit || dailySpendLimit == 0) {
            revert InvalidPolicyParams();
        }

        Policy storage p = policies[msg.sender];
        if (p.isFrozen) revert PolicyAlreadyFrozen();

        p.dailySpendLimit = dailySpendLimit;
        p.maxPerTransaction = maxPerTransaction;
        p.lastUpdated = block.timestamp;

        // Reuse PolicyUpdated event, keeping the old hash
        emit PolicyUpdated(msg.sender, dailySpendLimit, maxPerTransaction, p.policyHash, block.timestamp);
    }

    /**
     * @notice Emergency stop. Freezes the policy, signaling off-chain watchers to block all txs.
     */
    function freezePolicy() external {
        Policy storage p = policies[msg.sender];
        if (p.isFrozen) revert PolicyAlreadyFrozen();

        p.isFrozen = true;
        p.lastUpdated = block.timestamp;

        emit PolicyFrozen(msg.sender, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Get the policy for a specific agent.
     * @param agentAddress The address to query.
     */
    function getPolicy(address agentAddress) external view returns (
        uint256 dailySpendLimit,
        uint256 maxPerTransaction,
        bytes32 policyHash,
        bool isFrozen,
        uint256 lastUpdated
    ) {
        Policy memory p = policies[agentAddress];
        return (
            p.dailySpendLimit,
            p.maxPerTransaction,
            p.policyHash,
            p.isFrozen,
            p.lastUpdated
        );
    }
}
