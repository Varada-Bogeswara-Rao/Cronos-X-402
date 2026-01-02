pragma solidity ^0.5.16;

import "./TToken.sol";
import "./ErrorReporter.sol";
import "./PriceOracle.sol";
import "./TectonicCoreInterface.sol";
import "./TectonicCoreStorage.sol";
import "./TectonicSocketInterface.sol";
import "./Tonic.sol";

/**
 * @title Tectonic's TectonicCore Contract
 * @author Tectonic
 */
contract TectonicCore is TectonicCoreV6Storage, TectonicCoreInterface, TectonicCoreErrorReporter, ExponentialNoError {
    /// @notice Emitted when an admin supports a market
    event MarketListed(TToken tToken);

    /// @notice Emitted when an account enters a market
    event MarketEntered(TToken tToken, address account);

    /// @notice Emitted when an account exits a market
    event MarketExited(TToken tToken, address account);

    /// @notice Emitted when close factor is changed by admin
    event NewCloseFactor(uint oldCloseFactorMantissa, uint newCloseFactorMantissa);

    /// @notice Emitted when a collateral factor is changed by admin
    event NewCollateralFactor(TToken tToken, uint oldCollateralFactorMantissa, uint newCollateralFactorMantissa);

    /// @notice Emitted when liquidation incentive is changed by admin
    event NewLiquidationIncentive(uint oldLiquidationIncentiveMantissa, uint newLiquidationIncentiveMantissa);

    /// @notice Emitted when price oracle is changed
    event NewPriceOracle(PriceOracle oldPriceOracle, PriceOracle newPriceOracle);

    /// @notice Emitted when pause guardian is changed
    event NewPauseGuardian(address oldPauseGuardian, address newPauseGuardian);

    /// @notice Emitted when an action is paused globally
    event ActionPaused(string action, bool pauseState);

    /// @notice Emitted when an action is paused on a market
    event ActionPaused(TToken tToken, string action, bool pauseState);

    /// @notice Emitted when a new TONIC speed is calculated for a market
    event TonicSpeedUpdated(TToken indexed tToken, uint newSpeed);

    /// @notice Emitted when a new TONIC speed is set for a contributor
    event ContributorTonicSpeedUpdated(address indexed contributor, uint newSpeed);

    /// @notice Emitted when TONIC is distributed to a supplier
    event DistributedSupplierTonic(TToken indexed tToken, address indexed supplier, uint tonicDelta, uint tonicSupplyIndex);

    /// @notice Emitted when TONIC is distributed to a borrower
    event DistributedBorrowerTonic(TToken indexed tToken, address indexed borrower, uint tonicDelta, uint tonicBorrowIndex);

    /// @notice Emitted when borrow cap for a tToken is changed
    event NewBorrowCap(TToken indexed tToken, uint newBorrowCap);

    /// @notice Emitted when borrow cap guardian is changed
    event NewBorrowCapGuardian(address oldBorrowCapGuardian, address newBorrowCapGuardian);

    /// @notice Emitted when TONIC is granted by admin
    event TonicGranted(address recipient, uint amount);

    /// @notice Emitted when an account is added to the whitelist
    event WhitelistAccountAdded(address account);

    /// @notice Emitted when an account is removed from the whitelist
    event WhitelistAccountRemoved(address account);

    /// @notice Emitted when whitelist protect status is changed
    event WhitelistStatusChanged(bool enabled);

    /// @notice Emitted when a new tvl limit per user is updated
    event TVLProtectLimitUpdated(TToken indexed tToken, uint newLimitPerUser);

    /// @notice The initial TONIC index for a market
    uint224 public constant tonicInitialIndex = 1e36;

    // closeFactorMantissa must be strictly greater than this value
    uint internal constant closeFactorMinMantissa = 0.05e18; // 0.05

    // closeFactorMantissa must not exceed this value
    uint internal constant closeFactorMaxMantissa = 0.9e18; // 0.9

    // No collateralFactorMantissa may exceed this value
    uint internal constant collateralFactorMaxMantissa = 0.9e18; // 0.9

    constructor() public {
        admin = msg.sender;
    }

    /*** Assets You Are In ***/

    /**
     * @notice Returns the assets an account has entered
     * @param account The address of the account to pull assets for
     * @return A dynamic list with the assets the account has entered
     */
    function getAssetsIn(address account) external view returns (TToken[] memory) {
        TToken[] memory assetsIn = accountAssets[account];

        return assetsIn;
    }

    /**
     * @notice Returns whether the given account is entered in the given asset
     * @param account The address of the account to check
     * @param tToken The tToken to check
     * @return True if the account is in the asset, otherwise false.
     */
    function checkMembership(address account, TToken tToken) external view returns (bool) {
        return markets[address(tToken)].accountMembership[account];
    }

    /**
     * @notice Add assets to be included in account liquidity calculation
     * @param tTokens The list of addresses of the tToken markets to be enabled
     * @return Success indicator for whether each corresponding market was entered
     */
    function enterMarkets(address[] memory tTokens) public returns (uint[] memory) {
        uint len = tTokens.length;

        uint[] memory results = new uint[](len);
        for (uint i = 0; i < len; i++) {
            TToken tToken = TToken(tTokens[i]);

            results[i] = uint(addToMarketInternal(tToken, msg.sender));
        }

        return results;
    }

    /**
     * @notice Add the market to the borrower's "assets in" for liquidity calculations
     * @param tToken The market to enter
     * @param borrower The address of the account to modify
     * @return Success indicator for whether the market was entered
     */
    function addToMarketInternal(TToken tToken, address borrower) internal returns (Error) {
        Market storage marketToJoin = markets[address(tToken)];

        if (!marketToJoin.isListed) {
            // market is not listed, cannot join
            return Error.MARKET_NOT_LISTED;
        }

        if (marketToJoin.accountMembership[borrower] == true) {
            // already joined
            return Error.NO_ERROR;
        }

        // survived the gauntlet, add to list
        // NOTE: we store these somewhat redundantly as a significant optimization
        //  this avoids having to iterate through the list for the most common use cases
        //  that is, only when we need to perform liquidity checks
        //  and not whenever we want to check if an account is in a particular market
        marketToJoin.accountMembership[borrower] = true;
        accountAssets[borrower].push(tToken);

        emit MarketEntered(tToken, borrower);

        return Error.NO_ERROR;
    }

    /**
     * @notice Removes asset from sender's account liquidity calculation
     * @dev Sender must not have an outstanding borrow balance in the asset,
     *  or be providing necessary collateral for an outstanding borrow.
     * @param tTokenAddress The address of the asset to be removed
     * @return Whether or not the account successfully exited the market
     */
    function exitMarket(address tTokenAddress) external returns (uint) {
        TToken tToken = TToken(tTokenAddress);
        /* Get sender tokensHeld and amountOwed underlying from the tToken */
        (uint oErr, uint tokensHeld, uint amountOwed, ) = tToken.getAccountSnapshot(msg.sender);
        require(oErr == 0, "exitMarket: getAccountSnapshot failed"); // semi-opaque error code

        /* Fail if the sender has a borrow balance */
        if (amountOwed != 0) {
            return fail(Error.NONZERO_BORROW_BALANCE, FailureInfo.EXIT_MARKET_BALANCE_OWED);
        }

        /* Fail if the sender is not permitted to redeem all of their tokens */
        uint allowed = redeemAllowedInternal(tTokenAddress, msg.sender, tokensHeld);
        if (allowed != 0) {
            return failOpaque(Error.REJECTION, FailureInfo.EXIT_MARKET_REJECTION, allowed);
        }

        Market storage marketToExit = markets[address(tToken)];

        /* Return true if the sender is not already ‘in’ the market */
        if (!marketToExit.accountMembership[msg.sender]) {
            return uint(Error.NO_ERROR);
        }

        /* Set tToken account membership to false */
        delete marketToExit.accountMembership[msg.sender];

        /* Delete tToken from the account’s list of assets */
        // load into memory for faster iteration
        TToken[] memory userAssetList = accountAssets[msg.sender];
        uint len = userAssetList.length;
        uint assetIndex = len;
        for (uint i = 0; i < len; i++) {
            if (userAssetList[i] == tToken) {
                assetIndex = i;
                break;
            }
        }

        // We *must* have found the asset in the list or our redundant data structure is broken
        assert(assetIndex < len);

        // copy last item in list to location of item to be removed, reduce length by 1
        TToken[] storage storedList = accountAssets[msg.sender];
        storedList[assetIndex] = storedList[storedList.length - 1];
        storedList.length--;

        emit MarketExited(tToken, msg.sender);

        return uint(Error.NO_ERROR);
    }

    /*** Policy Hooks ***/

    /**
     * @notice Checks if the account should be allowed to mint tokens in the given market
     * @param tToken The market to verify the mint against
     * @param minter The account which would get the minted tokens
     * @param mintAmount The amount of underlying being supplied to the market in exchange for tokens
     * @return 0 if the mint is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function mintAllowed(address tToken, address minter, uint mintAmount) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!mintGuardianPaused[tToken], "mint is paused");

        // Shh - currently unused
        minter;
        mintAmount;

        // Check if whitelist is enabled

        if (whitelistProtectEnabled && whitelistedAddresses[minter] != true) {
            return uint(Error.WHITELIST_REJECTED);
        }

        // Check if max limit will exceed

        if (tokenToPerUserTvlProtectLimit[tToken] != 0) {

            // This token is applied with tvl limit
            uint currentUsed = utilizedTvlAmount[tToken][minter];
            uint afterMintedUsed = add_(currentUsed, mintAmount);
            if (afterMintedUsed > tokenToPerUserTvlProtectLimit[tToken]) {
                return uint(Error.TVL_PROTECT_EXCEEDED);
            }
            
            // Not exceed. Update used tvl limit
            utilizedTvlAmount[tToken][minter] = afterMintedUsed;
        }

        if (!markets[tToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        updateTonicSupplyIndex(tToken);
        distributeSupplierTonic(tToken, minter);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates mint and reverts on rejection. May emit logs.
     * @param tToken Asset being minted
     * @param minter The address minting the tokens
     * @param actualMintAmount The amount of the underlying asset being minted
     * @param mintTokens The number of tokens being minted
     */
    function mintVerify(address tToken, address minter, uint actualMintAmount, uint mintTokens) external {
        // Shh - currently unused
        tToken;
        minter;
        actualMintAmount;
        mintTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to redeem tokens in the given market
     * @param tToken The market to verify the redeem against
     * @param redeemer The account which would redeem the tokens
     * @param redeemTokens The number of tTokens to exchange for the underlying asset in the market
     * @return 0 if the redeem is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function redeemAllowed(address tToken, address redeemer, uint redeemTokens) external returns (uint) {
        uint allowed = redeemAllowedInternal(tToken, redeemer, redeemTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateTonicSupplyIndex(tToken);
        distributeSupplierTonic(tToken, redeemer);

        return uint(Error.NO_ERROR);
    }

    function redeemAllowedInternal(address tToken, address redeemer, uint redeemTokens) internal view returns (uint) {
        if (!markets[tToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        /* If the redeemer is not 'in' the market, then we can bypass the liquidity check */
        if (!markets[tToken].accountMembership[redeemer]) {
            return uint(Error.NO_ERROR);
        }

        /* Otherwise, perform a hypothetical liquidity check to guard against shortfall */
        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(redeemer, TToken(tToken), redeemTokens, 0);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall > 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates redeem and reverts on rejection. May emit logs.
     * @param tToken Asset being redeemed
     * @param redeemer The address redeeming the tokens
     * @param redeemAmount The amount of the underlying asset being redeemed
     * @param redeemTokens The number of tokens being redeemed
     */
    function redeemVerify(address tToken, address redeemer, uint redeemAmount, uint redeemTokens) external {
        // Shh - currently unused
        tToken;
        redeemer;

        // Require tokens is zero or amount is also zero
        if (redeemTokens == 0 && redeemAmount > 0) {
            revert("redeemTokens zero");
        }
    }

    /**
     * @notice Checks if the account should be allowed to borrow the underlying asset of the given market
     * @param tToken The market to verify the borrow against
     * @param borrower The account which would borrow the asset
     * @param borrowAmount The amount of underlying the account would borrow
     * @return 0 if the borrow is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function borrowAllowed(address tToken, address borrower, uint borrowAmount) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!borrowGuardianPaused[tToken], "borrow is paused");

        if (!markets[tToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (!markets[tToken].accountMembership[borrower]) {
            // only tTokens may call borrowAllowed if borrower not in market
            require(msg.sender == tToken, "sender must be tToken");

            // attempt to add borrower to the market
            Error err = addToMarketInternal(TToken(msg.sender), borrower);
            if (err != Error.NO_ERROR) {
                return uint(err);
            }

            // it should be impossible to break the important invariant
            assert(markets[tToken].accountMembership[borrower]);
        }

        if (oracle.getUnderlyingPrice(TToken(tToken)) == 0) {
            return uint(Error.PRICE_ERROR);
        }

        // Check if whitelist is enabled

        if (whitelistProtectEnabled && whitelistedAddresses[borrower] != true) {
            return uint(Error.WHITELIST_REJECTED);
        }

        uint borrowCap = borrowCaps[tToken];
        // Borrow cap of 0 corresponds to unlimited borrowing
        if (borrowCap != 0) {
            uint totalBorrows = TToken(tToken).totalBorrows();
            uint nextTotalBorrows = add_(totalBorrows, borrowAmount);
            require(nextTotalBorrows < borrowCap, "market borrow cap reached");
        }

        (Error err, , uint shortfall) = getHypotheticalAccountLiquidityInternal(borrower, TToken(tToken), 0, borrowAmount);
        if (err != Error.NO_ERROR) {
            return uint(err);
        }
        if (shortfall > 0) {
            return uint(Error.INSUFFICIENT_LIQUIDITY);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: TToken(tToken).borrowIndex()});
        updateTonicBorrowIndex(tToken, borrowIndex);
        distributeBorrowerTonic(tToken, borrower, borrowIndex);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates borrow and reverts on rejection. May emit logs.
     * @param tToken Asset whose underlying is being borrowed
     * @param borrower The address borrowing the underlying
     * @param borrowAmount The amount of the underlying asset requested to borrow
     */
    function borrowVerify(address tToken, address borrower, uint borrowAmount) external {
        // Shh - currently unused
        tToken;
        borrower;
        borrowAmount;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to repay a borrow in the given market
     * @param tToken The market to verify the repay against
     * @param payer The account which would repay the asset
     * @param borrower The account which would borrowed the asset
     * @param repayAmount The amount of the underlying asset the account would repay
     * @return 0 if the repay is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function repayBorrowAllowed(
        address tToken,
        address payer,
        address borrower,
        uint repayAmount) external returns (uint) {
        // Shh - currently unused
        payer;
        borrower;
        repayAmount;

        if (!markets[tToken].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        // Keep the flywheel moving
        Exp memory borrowIndex = Exp({mantissa: TToken(tToken).borrowIndex()});
        updateTonicBorrowIndex(tToken, borrowIndex);
        distributeBorrowerTonic(tToken, borrower, borrowIndex);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates repayBorrow and reverts on rejection. May emit logs.
     * @param tToken Asset being repaid
     * @param payer The address repaying the borrow
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function repayBorrowVerify(
        address tToken,
        address payer,
        address borrower,
        uint actualRepayAmount,
        uint borrowerIndex) external {
        // Shh - currently unused
        tToken;
        payer;
        borrower;
        actualRepayAmount;
        borrowerIndex;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the liquidation should be allowed to occur
     * @param tTokenBorrowed Asset which was borrowed by the borrower
     * @param tTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param repayAmount The amount of underlying being repaid
     */
    function liquidateBorrowAllowed(
        address tTokenBorrowed,
        address tTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount) external returns (uint) {
        // Shh - currently unused
        liquidator;

        if (!markets[tTokenBorrowed].isListed || !markets[tTokenCollateral].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        uint borrowBalance = TToken(tTokenBorrowed).borrowBalanceStored(borrower);

        /* allow accounts to be liquidated if the market is deprecated */
        if (isDeprecated(TToken(tTokenBorrowed))) {
            require(borrowBalance >= repayAmount, "Can not repay more than the total borrow");
        } else {
            /* The borrower must have shortfall in order to be liquidatable */
            (Error err, , uint shortfall) = getAccountLiquidityInternal(borrower);
            if (err != Error.NO_ERROR) {
                return uint(err);
            }

            if (shortfall == 0) {
                return uint(Error.INSUFFICIENT_SHORTFALL);
            }

            /* The liquidator may not repay more than what is allowed by the closeFactor */
            uint maxClose = mul_ScalarTruncate(Exp({mantissa: closeFactorMantissa}), borrowBalance);
            if (repayAmount > maxClose) {
                return uint(Error.TOO_MUCH_REPAY);
            }
        }
        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates liquidateBorrow and reverts on rejection. May emit logs.
     * @param tTokenBorrowed Asset which was borrowed by the borrower
     * @param tTokenCollateral Asset which was used as collateral and will be seized
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param actualRepayAmount The amount of underlying being repaid
     */
    function liquidateBorrowVerify(
        address tTokenBorrowed,
        address tTokenCollateral,
        address liquidator,
        address borrower,
        uint actualRepayAmount,
        uint seizeTokens) external {
        // Shh - currently unused
        tTokenBorrowed;
        tTokenCollateral;
        liquidator;
        borrower;
        actualRepayAmount;
        seizeTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the seizing of assets should be allowed to occur
     * @param tTokenCollateral Asset which was used as collateral and will be seized
     * @param tTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeAllowed(
        address tTokenCollateral,
        address tTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!seizeGuardianPaused, "seize is paused");

        // Shh - currently unused
        seizeTokens;

        if (!markets[tTokenCollateral].isListed || !markets[tTokenBorrowed].isListed) {
            return uint(Error.MARKET_NOT_LISTED);
        }

        if (TToken(tTokenCollateral).tectonicCore() != TToken(tTokenBorrowed).tectonicCore()) {
            return uint(Error.TECTONIC_CORE_MISMATCH);
        }

        // Keep the flywheel moving
        updateTonicSupplyIndex(tTokenCollateral);
        distributeSupplierTonic(tTokenCollateral, borrower);
        distributeSupplierTonic(tTokenCollateral, liquidator);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates seize and reverts on rejection. May emit logs.
     * @param tTokenCollateral Asset which was used as collateral and will be seized
     * @param tTokenBorrowed Asset which was borrowed by the borrower
     * @param liquidator The address repaying the borrow and seizing the collateral
     * @param borrower The address of the borrower
     * @param seizeTokens The number of collateral tokens to seize
     */
    function seizeVerify(
        address tTokenCollateral,
        address tTokenBorrowed,
        address liquidator,
        address borrower,
        uint seizeTokens) external {
        // Shh - currently unused
        tTokenCollateral;
        tTokenBorrowed;
        liquidator;
        borrower;
        seizeTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /**
     * @notice Checks if the account should be allowed to transfer tokens in the given market
     * @param tToken The market to verify the transfer against
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of tTokens to transfer
     * @return 0 if the transfer is allowed, otherwise a semi-opaque error code (See ErrorReporter.sol)
     */
    function transferAllowed(address tToken, address src, address dst, uint transferTokens) external returns (uint) {
        // Pausing is a very serious situation - we revert to sound the alarms
        require(!transferGuardianPaused, "transfer is paused");

        // Currently the only consideration is whether or not
        //  the src is allowed to redeem this many tokens
        uint allowed = redeemAllowedInternal(tToken, src, transferTokens);
        if (allowed != uint(Error.NO_ERROR)) {
            return allowed;
        }

        // Keep the flywheel moving
        updateTonicSupplyIndex(tToken);
        distributeSupplierTonic(tToken, src);
        distributeSupplierTonic(tToken, dst);

        return uint(Error.NO_ERROR);
    }

    /**
     * @notice Validates transfer and reverts on rejection. May emit logs.
     * @param tToken Asset being transferred
     * @param src The account which sources the tokens
     * @param dst The account which receives the tokens
     * @param transferTokens The number of tTokens to transfer
     */
    function transferVerify(address tToken, address src, address dst, uint transferTokens) external {
        // Shh - currently unused
        tToken;
        src;
        dst;
        transferTokens;

        // Shh - we don't ever want this hook to be marked pure
        if (false) {
            maxAssets = maxAssets;
        }
    }

    /*** Liquidity/Liquidation Calculations ***/

    /**
     * @dev Local vars for avoiding stack-depth limits in calculating account liquidity.
     *  Note that `tTokenBalance` is the number of tTokens the account owns in the market,
     *  whereas `borrowBalance` is the amount of underlying that the account has borrowed.
     */
    struct AccountLiquidityLocalVars {
        uint sumCollateral;
        uint sumBorrowPlusEffects;
        uint tTokenBalance;
        uint borrowBalance;
        uint exchangeRateMantissa;
        uint oraclePriceMantissa;
        Exp collateralFactor;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
    }

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code (semi-opaque),
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidity(address account) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, TToken(0), 0, 0);

        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine the current account liquidity wrt collateral requirements
     * @return (possible error code,
                account liquidity in excess of collateral requirements,
     *          account shortfall below collateral requirements)
     */
    function getAccountLiquidityInternal(address account) internal view returns (Error, uint, uint) {
        return getHypotheticalAccountLiquidityInternal(account, TToken(0), 0, 0);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param tTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @return (possible error code (semi-opaque),
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidity(
        address account,
        address tTokenModify,
        uint redeemTokens,
        uint borrowAmount) public view returns (uint, uint, uint) {
        (Error err, uint liquidity, uint shortfall) = getHypotheticalAccountLiquidityInternal(account, TToken(tTokenModify), redeemTokens, borrowAmount);
        return (uint(err), liquidity, shortfall);
    }

    /**
     * @notice Determine what the account liquidity would be if the given amounts were redeemed/borrowed
     * @param tTokenModify The market to hypothetically redeem/borrow in
     * @param account The account to determine liquidity for
     * @param redeemTokens The number of tokens to hypothetically redeem
     * @param borrowAmount The amount of underlying to hypothetically borrow
     * @dev Note that we calculate the exchangeRateStored for each collateral tToken using stored data,
     *  without calculating accumulated interest.
     * @return (possible error code,
                hypothetical account liquidity in excess of collateral requirements,
     *          hypothetical account shortfall below collateral requirements)
     */
    function getHypotheticalAccountLiquidityInternal(
        address account,
        TToken tTokenModify,
        uint redeemTokens,
        uint borrowAmount) internal view returns (Error, uint, uint) {

        AccountLiquidityLocalVars memory vars; // Holds all our calculation results
        uint oErr;

        // For each asset the account is in
        TToken[] memory assets = accountAssets[account];
        for (uint i = 0; i < assets.length; i++) {
            TToken asset = assets[i];

            // Read the balances and exchange rate from the tToken
            (oErr, vars.tTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = asset.getAccountSnapshot(account);
            if (oErr != 0) { // semi-opaque error code, we assume NO_ERROR == 0 is invariant between upgrades
                return (Error.SNAPSHOT_ERROR, 0, 0);
            }
            vars.collateralFactor = Exp({mantissa: markets[address(asset)].collateralFactorMantissa});
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = oracle.getUnderlyingPrice(asset);
            if (vars.oraclePriceMantissa == 0) {
                return (Error.PRICE_ERROR, 0, 0);
            }
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            // Pre-compute a conversion factor from tokens -> ether (normalized price value)
            vars.tokensToDenom = mul_(mul_(vars.collateralFactor, vars.exchangeRate), vars.oraclePrice);

            // sumCollateral += tokensToDenom * tTokenBalance
            vars.sumCollateral = mul_ScalarTruncateAddUInt(vars.tokensToDenom, vars.tTokenBalance, vars.sumCollateral);

            // sumBorrowPlusEffects += oraclePrice * borrowBalance
            vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.oraclePrice, vars.borrowBalance, vars.sumBorrowPlusEffects);

            // Calculate effects of interacting with tTokenModify
            if (asset == tTokenModify) {
                // redeem effect
                // sumBorrowPlusEffects += tokensToDenom * redeemTokens
                vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.tokensToDenom, redeemTokens, vars.sumBorrowPlusEffects);

                // borrow effect
                // sumBorrowPlusEffects += oraclePrice * borrowAmount
                vars.sumBorrowPlusEffects = mul_ScalarTruncateAddUInt(vars.oraclePrice, borrowAmount, vars.sumBorrowPlusEffects);
            }
        }

        // These are safe, as the underflow condition is checked first
        if (vars.sumCollateral > vars.sumBorrowPlusEffects) {
            return (Error.NO_ERROR, vars.sumCollateral - vars.sumBorrowPlusEffects, 0);
        } else {
            return (Error.NO_ERROR, 0, vars.sumBorrowPlusEffects - vars.sumCollateral);
        }
    }

    /**
     * @notice Calculate number of tokens of collateral asset to seize given an underlying amount
     * @dev Used in liquidation (called in tToken.liquidateBorrowFresh)
     * @param tTokenBorrowed The address of the borrowed tToken
     * @param tTokenCollateral The address of the collateral tToken
     * @param actualRepayAmount The amount of tTokenBorrowed underlying to convert into tTokenCollateral tokens
     * @return (errorCode, number of tTokenCollateral tokens to be seized in a liquidation)
     */
    function liquidateCalculateSeizeTokens(address tTokenBorrowed, address tTokenCollateral, uint actualRepayAmount) external view returns (uint, uint) {
        /* Read oracle prices for borrowed and collateral markets */
        uint priceBorrowedMantissa = oracle.getUnderlyingPrice(TToken(tTokenBorrowed));
        uint priceCollateralMantissa = oracle.getUnderlyingPrice(TToken(tTokenCollateral));
        if (priceBorrowedMantissa == 0 || priceCollateralMantissa == 0) {
            return (uint(Error.PRICE_ERROR), 0);
        }

        /*
         * Get the exchange rate and calculate the number of collateral tokens to seize:
         *  seizeAmount = actualRepayAmount * liquidationIncentive * priceBorrowed / priceCollateral
         *  seizeTokens = seizeAmount / exchangeRate
         *   = actualRepayAmount * (liquidationIncentive * priceBorrowed) / (priceCollateral * exchangeRate)
         */
        uint exchangeRateMantissa = TToken(tTokenCollateral).exchangeRateStored(); // Note: reverts on error
        uint seizeTokens;
        Exp memory numerator;
        Exp memory denominator;
        Exp memory ratio;

        numerator = mul_(Exp({mantissa: liquidationIncentiveMantissa}), Exp({mantissa: priceBorrowedMantissa}));
        denominator = mul_(Exp({mantissa: priceCollateralMantissa}), Exp({mantissa: exchangeRateMantissa}));
        ratio = div_(numerator, denominator);

        seizeTokens = mul_ScalarTruncate(ratio, actualRepayAmount);

        return (uint(Error.NO_ERROR), seizeTokens);
    }

    /*** Admin Functions ***/

    /**
      * @notice Sets a new price oracle for the tectonicCore
      * @dev Admin function to set a new price oracle
      * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
      */
    function _setPriceOracle(PriceOracle newOracle) public returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_PRICE_ORACLE_OWNER_CHECK);
        }

        // Track the old oracle for the tectonicCore
        PriceOracle oldOracle = oracle;

        // Set tectonicCore's oracle to newOracle
        oracle = newOracle;

        // Emit NewPriceOracle(oldOracle, newOracle)
        emit NewPriceOracle(oldOracle, newOracle);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the closeFactor used when liquidating borrows
      * @dev Admin function to set closeFactor
      * @param newCloseFactorMantissa New close factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure
      */
    function _setCloseFactor(uint newCloseFactorMantissa) external returns (uint) {
        // Check caller is admin
    	require(msg.sender == admin, "only admin can set close factor");

        uint oldCloseFactorMantissa = closeFactorMantissa;
        closeFactorMantissa = newCloseFactorMantissa;
        emit NewCloseFactor(oldCloseFactorMantissa, closeFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets the collateralFactor for a market
      * @dev Admin function to set per-market collateralFactor
      * @param tToken The market to set the factor on
      * @param newCollateralFactorMantissa The new collateral factor, scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setCollateralFactor(TToken tToken, uint newCollateralFactorMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_COLLATERAL_FACTOR_OWNER_CHECK);
        }

        // Verify market is listed
        Market storage market = markets[address(tToken)];
        if (!market.isListed) {
            return fail(Error.MARKET_NOT_LISTED, FailureInfo.SET_COLLATERAL_FACTOR_NO_EXISTS);
        }

        Exp memory newCollateralFactorExp = Exp({mantissa: newCollateralFactorMantissa});

        // Check collateral factor <= 0.9
        Exp memory highLimit = Exp({mantissa: collateralFactorMaxMantissa});
        if (lessThanExp(highLimit, newCollateralFactorExp)) {
            return fail(Error.INVALID_COLLATERAL_FACTOR, FailureInfo.SET_COLLATERAL_FACTOR_VALIDATION);
        }

        // If collateral factor != 0, fail if price == 0
        if (newCollateralFactorMantissa != 0 && oracle.getUnderlyingPrice(tToken) == 0) {
            return fail(Error.PRICE_ERROR, FailureInfo.SET_COLLATERAL_FACTOR_WITHOUT_PRICE);
        }

        // Set market's collateral factor to new collateral factor, remember old value
        uint oldCollateralFactorMantissa = market.collateralFactorMantissa;
        market.collateralFactorMantissa = newCollateralFactorMantissa;

        // Emit event with asset, old collateral factor, and new collateral factor
        emit NewCollateralFactor(tToken, oldCollateralFactorMantissa, newCollateralFactorMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Sets liquidationIncentive
      * @dev Admin function to set liquidationIncentive
      * @param newLiquidationIncentiveMantissa New liquidationIncentive scaled by 1e18
      * @return uint 0=success, otherwise a failure. (See ErrorReporter for details)
      */
    function _setLiquidationIncentive(uint newLiquidationIncentiveMantissa) external returns (uint) {
        // Check caller is admin
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_LIQUIDATION_INCENTIVE_OWNER_CHECK);
        }

        // Save current value for use in log
        uint oldLiquidationIncentiveMantissa = liquidationIncentiveMantissa;

        // Set liquidation incentive to new incentive
        liquidationIncentiveMantissa = newLiquidationIncentiveMantissa;

        // Emit event with old incentive, new incentive
        emit NewLiquidationIncentive(oldLiquidationIncentiveMantissa, newLiquidationIncentiveMantissa);

        return uint(Error.NO_ERROR);
    }

    /**
      * @notice Add the market to the markets mapping and set it as listed
      * @dev Admin function to set isListed and add support for the market
      * @param tToken The address of the market (token) to list
      * @return uint 0=success, otherwise a failure. (See enum Error for details)
      */
    function _supportMarket(TToken tToken) external returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SUPPORT_MARKET_OWNER_CHECK);
        }

        if (markets[address(tToken)].isListed) {
            return fail(Error.MARKET_ALREADY_LISTED, FailureInfo.SUPPORT_MARKET_EXISTS);
        }

        tToken.isTToken(); // Sanity check to make sure its really a TToken

        // Note that isTonicized is not in active use anymore
        markets[address(tToken)] = Market({isListed: true, isTonicized: false, collateralFactorMantissa: 0});

        _addMarketInternal(address(tToken));

        emit MarketListed(tToken);

        return uint(Error.NO_ERROR);
    }

    function _addMarketInternal(address tToken) internal {
        for (uint i = 0; i < allMarkets.length; i ++) {
            require(allMarkets[i] != TToken(tToken), "market already added");
        }
        allMarkets.push(TToken(tToken));
    }


    /**
      * @notice Set the given borrow caps for the given tToken markets. Borrowing that brings total borrows to or above borrow cap will revert.
      * @dev Admin or borrowCapGuardian function to set the borrow caps. A borrow cap of 0 corresponds to unlimited borrowing.
      * @param tTokens The addresses of the markets (tokens) to change the borrow caps for
      * @param newBorrowCaps The new borrow cap values in underlying to be set. A value of 0 corresponds to unlimited borrowing.
      */
    function _setMarketBorrowCaps(TToken[] calldata tTokens, uint[] calldata newBorrowCaps) external {
    	require(msg.sender == admin || msg.sender == borrowCapGuardian, "only admin or borrow cap guardian can set borrow caps"); 

        uint numMarkets = tTokens.length;
        uint numBorrowCaps = newBorrowCaps.length;

        require(numMarkets != 0 && numMarkets == numBorrowCaps, "invalid input");

        for(uint i = 0; i < numMarkets; i++) {
            borrowCaps[address(tTokens[i])] = newBorrowCaps[i];
            emit NewBorrowCap(tTokens[i], newBorrowCaps[i]);
        }
    }

    /**
     * @notice Admin function to change the Borrow Cap Guardian
     * @param newBorrowCapGuardian The address of the new Borrow Cap Guardian
     */
    function _setBorrowCapGuardian(address newBorrowCapGuardian) external {
        require(msg.sender == admin, "only admin can set borrow cap guardian");

        // Save current value for inclusion in log
        address oldBorrowCapGuardian = borrowCapGuardian;

        // Store borrowCapGuardian with value newBorrowCapGuardian
        borrowCapGuardian = newBorrowCapGuardian;

        // Emit NewBorrowCapGuardian(OldBorrowCapGuardian, NewBorrowCapGuardian)
        emit NewBorrowCapGuardian(oldBorrowCapGuardian, newBorrowCapGuardian);
    }

    /**
     * @notice Admin function to change the Pause Guardian
     * @param newPauseGuardian The address of the new Pause Guardian
     * @return uint 0=success, otherwise a failure. (See enum Error for details)
     */
    function _setPauseGuardian(address newPauseGuardian) public returns (uint) {
        if (msg.sender != admin) {
            return fail(Error.UNAUTHORIZED, FailureInfo.SET_PAUSE_GUARDIAN_OWNER_CHECK);
        }

        // Save current value for inclusion in log
        address oldPauseGuardian = pauseGuardian;

        // Store pauseGuardian with value newPauseGuardian
        pauseGuardian = newPauseGuardian;

        // Emit NewPauseGuardian(OldPauseGuardian, NewPauseGuardian)
        emit NewPauseGuardian(oldPauseGuardian, pauseGuardian);

        return uint(Error.NO_ERROR);
    }

    function _setMintPaused(TToken tToken, bool state) public returns (bool) {
        require(markets[address(tToken)].isListed, "cannot pause a market that is not listed");
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can pause");
        require(msg.sender == admin || state == true, "only admin can unpause");

        mintGuardianPaused[address(tToken)] = state;
        emit ActionPaused(tToken, "Mint", state);
        return state;
    }

    function _setBorrowPaused(TToken tToken, bool state) public returns (bool) {
        require(markets[address(tToken)].isListed, "cannot pause a market that is not listed");
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can pause");
        require(msg.sender == admin || state == true, "only admin can unpause");

        borrowGuardianPaused[address(tToken)] = state;
        emit ActionPaused(tToken, "Borrow", state);
        return state;
    }

    function _setTransferPaused(bool state) public returns (bool) {
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can pause");
        require(msg.sender == admin || state == true, "only admin can unpause");

        transferGuardianPaused = state;
        emit ActionPaused("Transfer", state);
        return state;
    }

    function _setSeizePaused(bool state) public returns (bool) {
        require(msg.sender == pauseGuardian || msg.sender == admin, "only pause guardian and admin can pause");
        require(msg.sender == admin || state == true, "only admin can unpause");

        seizeGuardianPaused = state;
        emit ActionPaused("Seize", state);
        return state;
    }

    function _become(TectonicSocketInterface unitroller) public {
        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        require(unitroller._acceptImplementation() == 0, "change not authorized");
    }

    /**
     * @notice Checks caller is admin, or this contract is becoming the new implementation
     */
    function adminOrInitializing() internal view returns (bool) {
        return msg.sender == admin || msg.sender == tectonicCoreImplementation;
    }

    /*** Tonic Distribution ***/

    /**
     * @notice Set TONIC speed for a single market
     * @param tToken The market whose TONIC speed to update
     * @param tonicSpeed New TONIC speed for market
     */
    function setTonicSpeedInternal(TToken tToken, uint tonicSpeed) internal {
        uint currentTonicSpeed = tonicSpeeds[address(tToken)];
        if (currentTonicSpeed != 0) {
            // note that TONIC speed could be set to 0 to halt liquidity rewards for a market
            Exp memory borrowIndex = Exp({mantissa: tToken.borrowIndex()});
            updateTonicSupplyIndex(address(tToken));
            updateTonicBorrowIndex(address(tToken), borrowIndex);
        } else if (tonicSpeed != 0) {
            // Add the TONIC market
            Market storage market = markets[address(tToken)];
            require(market.isListed == true, "tonic market is not listed");

            if (tonicSupplyState[address(tToken)].index == 0) {
                tonicSupplyState[address(tToken)] = TonicMarketState({
                    index: tonicInitialIndex,
                    block: safe32(getBlockNumber(), "block number exceeds 32 bits")
                });
            } else {
                // Update block number to ensure extra interest is not accrued during the prior period
                tonicSupplyState[address(tToken)].block = safe32(getBlockNumber(), "block number exceeds 32 bits");
            }

            if (tonicBorrowState[address(tToken)].index == 0) {
                tonicBorrowState[address(tToken)] = TonicMarketState({
                    index: tonicInitialIndex,
                    block: safe32(getBlockNumber(), "block number exceeds 32 bits")
                });
            } else {
                // Update block number to ensure extra interest is not accrued during the prior period
                tonicBorrowState[address(tToken)].block = safe32(getBlockNumber(), "block number exceeds 32 bits");
            }
        }

        if (currentTonicSpeed != tonicSpeed) {
            tonicSpeeds[address(tToken)] = tonicSpeed;
            emit TonicSpeedUpdated(tToken, tonicSpeed);
        }
    }


    /**
     * @notice Accrue TONIC to the market by updating the supply index
     * @param tToken The market whose supply index to update
     */
    function updateTonicSupplyIndex(address tToken) internal {
        TonicMarketState storage supplyState = tonicSupplyState[tToken];
        uint supplySpeed = tonicSpeeds[tToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(supplyState.block));
        if (deltaBlocks > 0 && supplySpeed > 0) {
            uint supplyTokens = TToken(tToken).totalSupply();
            uint tonicAccrued = mul_(deltaBlocks, supplySpeed);
            Double memory ratio = supplyTokens > 0 ? fraction(tonicAccrued, supplyTokens) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: supplyState.index}), ratio);
            tonicSupplyState[tToken] = TonicMarketState({
                index: safe224(index.mantissa, "new index exceeds 224 bits"),
                block: safe32(blockNumber, "block number exceeds 32 bits")
            });
        } else if (deltaBlocks > 0) {
            supplyState.block = safe32(blockNumber, "block number exceeds 32 bits");
        }
    }

    /**
     * @notice Accrue TONIC to the market by updating the borrow index
     * @param tToken The market whose borrow index to update
     */
    function updateTonicBorrowIndex(address tToken, Exp memory marketBorrowIndex) internal {
        TonicMarketState storage borrowState = tonicBorrowState[tToken];
        uint borrowSpeed = tonicSpeeds[tToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, uint(borrowState.block));
        if (deltaBlocks > 0 && borrowSpeed > 0) {
            uint borrowAmount = div_(TToken(tToken).totalBorrows(), marketBorrowIndex);
            uint tonicAccrued = mul_(deltaBlocks, borrowSpeed);
            Double memory ratio = borrowAmount > 0 ? fraction(tonicAccrued, borrowAmount) : Double({mantissa: 0});
            Double memory index = add_(Double({mantissa: borrowState.index}), ratio);
            tonicBorrowState[tToken] = TonicMarketState({
                index: safe224(index.mantissa, "new index exceeds 224 bits"),
                block: safe32(blockNumber, "block number exceeds 32 bits")
            });
        } else if (deltaBlocks > 0) {
            borrowState.block = safe32(blockNumber, "block number exceeds 32 bits");
        }
    }

    /**
     * @notice Calculate TONIC accrued by a supplier and possibly transfer it to them
     * @param tToken The market in which the supplier is interacting
     * @param supplier The address of the supplier to distribute TONIC to
     */
    function distributeSupplierTonic(address tToken, address supplier) internal {
        TonicMarketState storage supplyState = tonicSupplyState[tToken];
        Double memory supplyIndex = Double({mantissa: supplyState.index});
        Double memory supplierIndex = Double({mantissa: tonicSupplierIndex[tToken][supplier]});
        tonicSupplierIndex[tToken][supplier] = supplyIndex.mantissa;

        if (supplierIndex.mantissa == 0 && supplyIndex.mantissa > 0) {
            supplierIndex.mantissa = tonicInitialIndex;
        }

        Double memory deltaIndex = sub_(supplyIndex, supplierIndex);
        uint supplierTokens = TToken(tToken).balanceOf(supplier);
        uint supplierDelta = mul_(supplierTokens, deltaIndex);
        uint supplierAccrued = add_(tonicAccrued[supplier], supplierDelta);
        tonicAccrued[supplier] = supplierAccrued;
        emit DistributedSupplierTonic(TToken(tToken), supplier, supplierDelta, supplyIndex.mantissa);
    }

    /**
     * @notice Calculate TONIC accrued by a borrower and possibly transfer it to them
     * @dev Borrowers will not begin to accrue until after the first interaction with the protocol.
     * @param tToken The market in which the borrower is interacting
     * @param borrower The address of the borrower to distribute TONIC to
     */
    function distributeBorrowerTonic(address tToken, address borrower, Exp memory marketBorrowIndex) internal {
        TonicMarketState storage borrowState = tonicBorrowState[tToken];
        Double memory borrowIndex = Double({mantissa: borrowState.index});
        Double memory borrowerIndex = Double({mantissa: tonicBorrowerIndex[tToken][borrower]});
        tonicBorrowerIndex[tToken][borrower] = borrowIndex.mantissa;

        if (borrowerIndex.mantissa > 0) {
            Double memory deltaIndex = sub_(borrowIndex, borrowerIndex);
            uint borrowerAmount = div_(TToken(tToken).borrowBalanceStored(borrower), marketBorrowIndex);
            uint borrowerDelta = mul_(borrowerAmount, deltaIndex);
            uint borrowerAccrued = add_(tonicAccrued[borrower], borrowerDelta);
            tonicAccrued[borrower] = borrowerAccrued;
            emit DistributedBorrowerTonic(TToken(tToken), borrower, borrowerDelta, borrowIndex.mantissa);
        }
    }

    /**
     * @notice Calculate additional accrued TONIC for a contributor since last accrual
     * @param contributor The address to calculate contributor rewards for
     */
    function updateContributorRewards(address contributor) public {
        uint tonicSpeed = tonicContributorSpeeds[contributor];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = sub_(blockNumber, lastContributorBlock[contributor]);
        if (deltaBlocks > 0 && tonicSpeed > 0) {
            uint newAccrued = mul_(deltaBlocks, tonicSpeed);
            uint contributorAccrued = add_(tonicAccrued[contributor], newAccrued);

            tonicAccrued[contributor] = contributorAccrued;
            lastContributorBlock[contributor] = blockNumber;
        }
    }

    /**
     * @notice Claim all the tonic accrued by holder in all markets
     * @param holder The address to claim TONIC for
     */
    function claimTonic(address holder) public {
        return claimTonic(holder, allMarkets);
    }

    /**
     * @notice Claim all the tonic accrued by holder in the specified markets
     * @param holder The address to claim TONIC for
     * @param tTokens The list of markets to claim TONIC in
     */
    function claimTonic(address holder, TToken[] memory tTokens) public {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimTonic(holders, tTokens, true, true);
    }

    /**
     * @notice Claim all tonic accrued by the holders
     * @param holders The addresses to claim TONIC for
     * @param tTokens The list of markets to claim TONIC in
     * @param borrowers Whether or not to claim TONIC earned by borrowing
     * @param suppliers Whether or not to claim TONIC earned by supplying
     */
    function claimTonic(address[] memory holders, TToken[] memory tTokens, bool borrowers, bool suppliers) public {
        for (uint i = 0; i < tTokens.length; i++) {
            TToken tToken = tTokens[i];
            require(markets[address(tToken)].isListed, "market must be listed");
            if (borrowers == true) {
                Exp memory borrowIndex = Exp({mantissa: tToken.borrowIndex()});
                updateTonicBorrowIndex(address(tToken), borrowIndex);
                for (uint j = 0; j < holders.length; j++) {
                    distributeBorrowerTonic(address(tToken), holders[j], borrowIndex);
                }
            }
            if (suppliers == true) {
                updateTonicSupplyIndex(address(tToken));
                for (uint j = 0; j < holders.length; j++) {
                    distributeSupplierTonic(address(tToken), holders[j]);
                }
            }
        }
        for (uint j = 0; j < holders.length; j++) {
            tonicAccrued[holders[j]] = grantTonicInternal(holders[j], tonicAccrued[holders[j]]);
        }
    }

    /**
     * @notice Transfer TONIC to the user
     * @dev Note: If there is not enough TONIC, we do not perform the transfer all.
     * @param user The address of the user to transfer TONIC to
     * @param amount The amount of TONIC to (possibly) transfer
     * @return The amount of TONIC which was NOT transferred to the user
     */
    function grantTonicInternal(address user, uint amount) internal returns (uint) {
        Tonic tonic = Tonic(getTonicAddress());
        uint tonicRemaining = tonic.balanceOf(address(this));
        if (amount > 0 && amount <= tonicRemaining) {
            tonic.transfer(user, amount);
            return 0;
        }
        return amount;
    }

    /*** Tonic Distribution Admin ***/

    /**
     * @notice Transfer TONIC to the recipient
     * @dev Note: If there is not enough TONIC, we do not perform the transfer all.
     * @param recipient The address of the recipient to transfer TONIC to
     * @param amount The amount of TONIC to (possibly) transfer
     */
    function _grantTonic(address recipient, uint amount) public {
        require(adminOrInitializing(), "only admin can grant tonic");
        uint amountLeft = grantTonicInternal(recipient, amount);
        require(amountLeft == 0, "insufficient tonic for grant");
        emit TonicGranted(recipient, amount);
    }

    /**
     * @notice Set TONIC speed for a single market
     * @param tToken The market whose TONIC speed to update
     * @param tonicSpeed New TONIC speed for market
     */
    function _setTonicSpeed(TToken tToken, uint tonicSpeed) public {
        require(adminOrInitializing(), "only admin can set tonic speed");
        setTonicSpeedInternal(tToken, tonicSpeed);
    }

    /**
     * @notice Set TONIC speed for a single contributor
     * @param contributor The contributor whose TONIC speed to update
     * @param tonicSpeed New TONIC speed for contributor
     */
    function _setContributorTonicSpeed(address contributor, uint tonicSpeed) public {
        require(adminOrInitializing(), "only admin can set tonic speed");

        // note that TONIC speed could be set to 0 to halt liquidity rewards for a contributor
        updateContributorRewards(contributor);
        if (tonicSpeed == 0) {
            // release storage
            delete lastContributorBlock[contributor];
        } else {
            lastContributorBlock[contributor] = getBlockNumber();
        }
        tonicContributorSpeeds[contributor] = tonicSpeed;

        emit ContributorTonicSpeedUpdated(contributor, tonicSpeed);
    }

    /**
     * @notice Return all of the markets
     * @dev The automatic getter may be used to access an individual market.
     * @return The list of market addresses
     */
    function getAllMarkets() public view returns (TToken[] memory) {
        return allMarkets;
    }

    /**
     * @notice Returns true if the given tToken market has been deprecated
     * @dev All borrows in a deprecated tToken market can be immediately liquidated
     * @param tToken The market to check if deprecated
     */
    function isDeprecated(TToken tToken) public view returns (bool) {
        return
            markets[address(tToken)].collateralFactorMantissa == 0 && 
            borrowGuardianPaused[address(tToken)] == true && 
            tToken.reserveFactorMantissa() == 1e18
        ;
    }

    function getBlockNumber() public view returns (uint) {
        return block.number;
    }

    /**
     * @notice Return the address of the TONIC token
     * @return The address of TONIC
     */
    function getTonicAddress() public view returns (address) {
        return tonicTokenContract;
    }

    /**
     * @notice Set the address of the TONIC token
     */
    function setTonicAddress(address _tonicAddress) public {
        require(adminOrInitializing(), "only admin can set tonic address");
        if (tonicTokenContract != address(0)) {
            revert("tonic address is already set");
        }
        tonicTokenContract = _tonicAddress;
    }


    /**
     * @notice Enable/Disable global whitelist protect
     * @param whitelistStatus enabled or disabled status to update
     */
    function _setWhitelistProtect(bool whitelistStatus) public {
        require(adminOrInitializing(), "only admin can change whitelist");
        whitelistProtectEnabled = whitelistStatus;
        emit WhitelistStatusChanged(whitelistStatus);
    }

    /**
     * @notice Enroll accounts to whitelist
     * @param accounts Accounts to be added
     */
    function _addToWhitelistProtect(address[] memory accounts) public {
        require(adminOrInitializing(), "only admin can change whitelist");

        uint numAccount = accounts.length;
        for (uint i = 0; i < numAccount; i++) {
            _addToWhitelistProtectSingle(accounts[i]);
        }
    }

    function _addToWhitelistProtectSingle(address account) internal {
        whitelistedAddresses[account] = true;
        emit WhitelistAccountAdded(account);
    }

    /**
     * @notice Remove account from whitelist
     * @param account Account to be removed
     */
    function _removeFromWhitelistProtect(address account) public {
        require(adminOrInitializing(), "only admin can change whitelist");
        whitelistedAddresses[account] = false;
        emit WhitelistAccountRemoved(account);
    }

    /**
     * @notice Update TVL protect limit for a tToken per user
     * @param tTokens tTokens to be updated
     * @param newLimitPerUser new tvl protect limit
     */
    function _updateTvlProtectLimit(TToken[] memory tTokens, uint[] memory newLimitPerUser) public {
        require(adminOrInitializing(), "only admin can change TVL protect limit");
        require(tTokens.length == newLimitPerUser.length, "Tokens and newLimitPerUser array length must be equal");
        for (uint i = 0; i < tTokens.length; i++) {
            tokenToPerUserTvlProtectLimit[address(tTokens[i])] = newLimitPerUser[i];
            emit TVLProtectLimitUpdated(tTokens[i], newLimitPerUser[i]);
        }
    }


}
