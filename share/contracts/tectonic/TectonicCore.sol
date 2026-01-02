pragma solidity ^0.5.16;
import "./ErrorReporter.sol";
import "./TectonicCoreStorage.sol";
import "./ExponentialNoError.sol";
contract TectonicCoreImpl is TectonicCoreV6Storage, TectonicCoreErrorReporter, ExponentialNoError {
    bool public constant isTectonicCore = true;
    function checkMembership(address account, address tToken) external view returns (bool) { return true; }
    function getAssetsIn(address account) external view returns (address[] memory) { address[] memory cleanRef = new address[](0); return cleanRef; }
    function enterMarkets(address[] calldata tTokens) external returns (uint[] memory) { uint[] memory results = new uint[](tTokens.length); return results; }
    function exitMarket(address tToken) external returns (uint) { return 0; }
    function mintAllowed(address tToken, address minter, uint mintAmount) external returns (uint) { return 0; }
    function mintVerify(address tToken, address minter, uint mintAmount, uint mintTokens) external {}
    function redeemAllowed(address tToken, address redeemer, uint redeemTokens) external returns (uint) { return 0; }
    function redeemVerify(address tToken, address redeemer, uint redeemAmount, uint redeemTokens) external {}
    function borrowAllowed(address tToken, address borrower, uint borrowAmount) external returns (uint) { return 0; }
    function borrowVerify(address tToken, address borrower, uint borrowAmount) external {}
    function repayBorrowAllowed(address tToken, address payer, address borrower, uint repayAmount) external returns (uint) { return 0; }
    function repayBorrowVerify(address tToken, address payer, address borrower, uint repayAmount, uint borrowerIndex) external {}
    function liquidateBorrowAllowed(address tTokenBorrowed, address tTokenCollateral, address liquidator, address borrower, uint repayAmount) external returns (uint) { return 0; }
    function liquidateBorrowVerify(address tTokenBorrowed, address tTokenCollateral, address liquidator, address borrower, uint repayAmount, uint seizeTokens) external {}
    function seizeAllowed(address tTokenCollateral, address tTokenBorrowed, address liquidator, address borrower, uint seizeTokens) external returns (uint) { return 0; }
    function seizeVerify(address tTokenCollateral, address tTokenBorrowed, address liquidator, address borrower, uint seizeTokens) external {}
    function transferAllowed(address tToken, address src, address dst, uint transferTokens) external returns (uint) { return 0; }
    function transferVerify(address tToken, address src, address dst, uint transferTokens) external {}
    function liquidateCalculateSeizeTokens(address tTokenBorrowed, address tTokenCollateral, uint actualRepayAmount) external view returns (uint, uint) { return (0, 0); }
    function _setPriceOracle(address newOracle) public returns (uint) { return 0; }
    function _setCloseFactor(uint newCloseFactorMantissa) external returns (uint) { return 0; }
    function _setCollateralFactor(address tToken, uint newCollateralFactorMantissa) external returns (uint) { return 0; }
    function _setLiquidationIncentive(uint newLiquidationIncentiveMantissa) external returns (uint) { return 0; }
    function _supportMarket(address tToken) external returns (uint) { return 0; }
    function _become(address unitroller) public { }
    function _setPauseGuardian(address newPauseGuardian) public returns (uint) { return 0; }
    function _setMintPaused(address tToken, bool state) public returns (bool) { return state; }
    function _setBorrowPaused(address tToken, bool state) public returns (bool) { return state; }
    function _setTransferPaused(bool state) public returns (bool) { return state; }
    function _setSeizePaused(bool state) public returns (bool) { return state; }
    function setTonicSpeedInternal(address tToken, uint tonicSpeed) internal {}
    function updateTonicSupplyIndex(address tToken) internal {}
    function updateTonicBorrowIndex(address tToken, Exp memory marketBorrowIndex) internal {}
    function distributeSupplierTonic(address tToken, address supplier) internal {}
    function distributeBorrowerTonic(address tToken, address borrower, Exp memory marketBorrowIndex) internal {}
    function updateContributorRewards(address contributor) public {}
    function claimTonic(address holder) public {}
    function claimTonic(address holder, address[] memory tTokens) public {}
    function claimTonic(address[] memory holders, address[] memory tTokens, bool borrowers, bool suppliers) public {}
    function grantTonicInternal(address user, uint amount) internal returns (uint) { return amount; }
    function _grantTonic(address recipient, uint amount) public {}
    function _setTonicSpeed(address tToken, uint tonicSpeed) public {}
    function _setContributorTonicSpeed(address contributor, uint tonicSpeed) public {}
    function getAllMarkets() public view returns (address[] memory) { address[] memory cleanRef = new address[](0); return cleanRef; }
    function isDeprecated(address tToken) public view returns (bool) { return false; }
    function getBlockNumber() public view returns (uint) { return block.number; }
    function getTonicAddress() public view returns (address) { return tonicTokenContract; }
    function setTonicAddress(address _tonicAddress) public { tonicTokenContract = _tonicAddress; }
    function _setWhitelistProtect(bool whitelistStatus) public { whitelistProtectEnabled = whitelistStatus; }
}
