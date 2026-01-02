pragma solidity ^0.5.16;

interface TectonicSocketInterface {
    function admin() external view returns (address payable);
    function _acceptImplementation() external returns (uint);
}
