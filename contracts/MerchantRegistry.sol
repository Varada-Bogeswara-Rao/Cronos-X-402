// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MerchantRegistry
 * @notice On-chain identity registry for API merchants using x402 payments.
 * @dev Stores merchant identity mapping (merchantId -> wallet).
 *      No payment logic. No admin controls.
 */
contract MerchantRegistry {
    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Merchant {
        address walletAddress;
        string metadataURI; // IPFS hash or URL for merchant details
        uint256 registeredAt; // Timestamp of registration
        bool isActive;
    }

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------

    /// @notice Maps merchantId (string) to their on-chain identity
    mapping(string => Merchant) private merchants;

    /// @notice Reverse mapping to check if a wallet already registered (optional but good for UX)
    mapping(address => string) private walletToMerchantId;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event MerchantRegistered(
        string indexed merchantId,
        address indexed wallet,
        string metadataURI,
        uint256 timestamp
    );

    event MerchantUpdated(
        string indexed merchantId,
        string newMetadataURI,
        uint256 timestamp
    );

    event MerchantDeactivated(
        string indexed merchantId,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error MerchantAlreadyExists();
    error Unauthorized();
    error InvalidMerchantId();
    error MerchantNotFound();

    // -------------------------------------------------------------------------
    // Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Registers a new merchant identity on-chain.
     * @param merchantId The off-chain generated unique ID (e.g. UUID).
     * @param metadataURI IPFS hash or URL containing merchant details (name, logo, etc).
     */
    function registerMerchant(string calldata merchantId, string calldata metadataURI) external {
        if (bytes(merchantId).length == 0) revert InvalidMerchantId();
        if (merchants[merchantId].walletAddress != address(0)) revert MerchantAlreadyExists();
        
        // Enforce one merchant ID per wallet for clarity
        if (bytes(walletToMerchantId[msg.sender]).length != 0) revert MerchantAlreadyExists();

        merchants[merchantId] = Merchant({
            walletAddress: msg.sender,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            isActive: true
        });

        walletToMerchantId[msg.sender] = merchantId;

        emit MerchantRegistered(merchantId, msg.sender, metadataURI, block.timestamp);
    }

    /**
     * @notice Updates merchant metadata. Only callable by the registered wallet.
     * @param merchantId The ID of the merchant to update.
     * @param newMetadataURI The new metadata URI.
     */
    function updateMerchant(string calldata merchantId, string calldata newMetadataURI) external {
        Merchant storage merchant = merchants[merchantId];

        if (merchant.walletAddress == address(0)) revert MerchantNotFound();
        if (merchant.walletAddress != msg.sender) revert Unauthorized();

        merchant.metadataURI = newMetadataURI;

        emit MerchantUpdated(merchantId, newMetadataURI, block.timestamp);
    }

    /**
     * @notice Deactivates a merchant. Only callable by the registered wallet.
     * @dev Does not delete the record, just sets isActive to false.
     * @param merchantId The ID of the merchant to deactivate.
     */
    function deactivateMerchant(string calldata merchantId) external {
        Merchant storage merchant = merchants[merchantId];

        if (merchant.walletAddress == address(0)) revert MerchantNotFound();
        if (merchant.walletAddress != msg.sender) revert Unauthorized();

        merchant.isActive = false;

        emit MerchantDeactivated(merchantId, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Retrieve merchant details.
     * @param merchantId The ID to look up.
     * @return wallet The registered wallet address.
     * @return isActive Whether the merchant is currently active.
     * @return metadataURI The metadata IPFS hash/URL.
     */
    function getMerchant(string calldata merchantId) external view returns (address wallet, bool isActive, string memory metadataURI) {
        Merchant memory merchant = merchants[merchantId];
        return (merchant.walletAddress, merchant.isActive, merchant.metadataURI);
    }

    /**
     * @notice Reverse lookup for UX/Dashboard purposes.
     * @param wallet The wallet address to query.
     * @return merchantId The merchant ID associated with this wallet, or empty string if none.
     */
    function getMerchantIdByWallet(address wallet) external view returns (string memory) {
        return walletToMerchantId[wallet];
    }
}
