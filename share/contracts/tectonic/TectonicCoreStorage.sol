pragma solidity ^0.5.16;

//import "./TToken.sol";
import "./PriceOracle.sol";

contract TectonicSocketAdminStorage {
    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    /**
    * @notice Active brains of TectonicSocket
    */
    address public tectonicCoreImplementation;

    /**
    * @notice Pending brains of TectonicSocket
    */
    address public pendingTectonicCoreImplementation;
}

contract TectonicCoreV1Storage is TectonicSocketAdminStorage {

    /**
     * @notice Oracle which gives the price of any given asset
     */
    PriceOracle public oracle;

    /**
     * @notice Multiplier used to calculate the maximum repayAmount when liquidating a borrow
     */
    uint public closeFactorMantissa;

    /**
     * @notice Multiplier representing the discount on collateral that a liquidator receives
     */
    uint public liquidationIncentiveMantissa;

    /**
     * @notice Max number of assets a single account can participate in (borrow or use as collateral)
     */
    uint public maxAssets;

    /**
     * @notice Per-account mapping of "assets you are in", capped by maxAssets
     */
    mapping(address => address[]) public accountAssets;

}

contract TectonicCoreV2Storage is TectonicCoreV1Storage {
    struct Market {
        /// @notice Whether or not this market is listed
        bool isListed;

        /**
         * @notice Multiplier representing the most one can borrow against their collateral in this market.
         *  For instance, 0.9 to allow borrowing 90% of collateral value.
         *  Must be between 0 and 1, and stored as a mantissa.
         */
        uint collateralFactorMantissa;

        /// @notice Per-market mapping of "accounts in this asset"
        mapping(address => bool) accountMembership;

        /// @notice Whether or not this market receives TONIC
        bool isTonicized;
    }

    /**
     * @notice Official mapping of tTokens -> Market metadata
     * @dev Used e.g. to determine if a market is supported
     */
    mapping(address => Market) public markets;


    /**
     * @notice The Pause Guardian can pause certain actions as a safety mechanism.
     *  Actions which allow users to remove their own assets cannot be paused.
     *  Liquidation / seizing / transfer can only be paused globally, not by market.
     */
    address public pauseGuardian;
    bool public _mintGuardianPaused;
    bool public _borrowGuardianPaused;
    bool public transferGuardianPaused;
    bool public seizeGuardianPaused;
    mapping(address => bool) public mintGuardianPaused;
    mapping(address => bool) public borrowGuardianPaused;
}

contract TectonicCoreV3Storage is TectonicCoreV2Storage {
    struct TonicMarketState {
        /// @notice The market's last updated tonicBorrowIndex or tonicSupplyIndex
        uint224 index;

        /// @notice The block number the index was last updated at
        uint32 block;
    }

    /// @notice A list of all markets
    TToken[] public allMarkets;

    /// @notice The rate at which the flywheel distributes TONIC, per block
    uint public tonicRate;

    /// @notice The portion of tonicRate that each market currently receives
    mapping(address => uint) public tonicSpeeds;

    /// @notice The TONIC market supply state for each market
    mapping(address => TonicMarketState) public tonicSupplyState;

    /// @notice The TONIC market borrow state for each market
    mapping(address => TonicMarketState) public tonicBorrowState;

    /// @notice The TONIC borrow index for each market for each supplier as of the last time they accrued TONIC
    mapping(address => mapping(address => uint)) public tonicSupplierIndex;

    /// @notice The TONIC borrow index for each market for each borrower as of the last time they accrued TONIC
    mapping(address => mapping(address => uint)) public tonicBorrowerIndex;

    /// @notice The TONIC accrued but not yet transferred to each user
    mapping(address => uint) public tonicAccrued;
}

contract TectonicCoreV4Storage is TectonicCoreV3Storage {
    // @notice The borrowCapGuardian can set borrowCaps to any number for any market. Lowering the borrow cap could disable borrowing on the given market.
    address public borrowCapGuardian;

    // @notice Borrow caps enforced by borrowAllowed for each tToken address. Defaults to zero which corresponds to unlimited borrowing.
    mapping(address => uint) public borrowCaps;
}

contract TectonicCoreV5Storage is TectonicCoreV4Storage {
    /// @notice The portion of TONIC that each contributor receives per block
    mapping(address => uint) public tonicContributorSpeeds;

    /// @notice Last block at which a contributor's TONIC rewards have been allocated
    mapping(address => uint) public lastContributorBlock;
}

contract TectonicCoreV6Storage is TectonicCoreV5Storage {

    address tonicTokenContract;
    
    bool public whitelistProtectEnabled;

    mapping(address => bool) public whitelistedAddresses;

    // tokenAddress (TToken) => maxTvlLimitPerUser
    mapping(address => uint) public tokenToPerUserTvlProtectLimit;

    // tokenAddress (TToken) => userAddress => usedTvlLimit
    mapping(address => mapping (address => uint)) public utilizedTvlAmount;

}

contract TectonicCoreStorage is TectonicCoreV6Storage {}
