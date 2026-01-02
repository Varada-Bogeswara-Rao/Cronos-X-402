pragma solidity ^0.5.16;

import "./PriceOracle.sol";

contract SimplePriceOracle is PriceOracle {
    mapping(address => uint) public prices;
    event PricePosted(address asset, uint previousPriceMantissa, uint requestedPriceMantissa, uint newPriceMantissa);

    function getUnderlyingPrice(TToken tToken) external view returns (uint) {
        return prices[address(tToken)];
    }

    function setUnderlyingPrice(TToken tToken, uint underlyingPriceMantissa) external {
        emit PricePosted(address(tToken), prices[address(tToken)], underlyingPriceMantissa, underlyingPriceMantissa);
        prices[address(tToken)] = underlyingPriceMantissa;
    }
}
