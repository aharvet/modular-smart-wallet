// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "../third-party/WebAuthn.sol";

contract MockWebAuthn {
    function verifySignature(
        bytes memory challenge,
        bytes memory authenticatorData,
        bool requireUserVerification,
        string memory clientDataJSON,
        uint256 challengeLocation,
        uint256 responseTypeLocation,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) public view returns (bool) {
        return WebAuthn.verifySignature(
            challenge,
            authenticatorData,
            requireUserVerification,
            clientDataJSON,
            challengeLocation,
            responseTypeLocation,
            r,
            s,
            x,
            y
        );
    }
}
