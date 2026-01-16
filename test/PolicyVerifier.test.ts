
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PolicyVerifier", function () {
    async function deployFixture() {
        const [deployer, agent, other] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("PolicyVerifier");
        const verifier = await Factory.deploy();
        return { verifier: verifier as any, agent, other };
    }

    // Helper to sign message with EIP-191 using internal abi.encode structure
    async function signClaim(signer: any, merchantId: string, maxAmount: number, validUntil: number) {
        // match contract logic: keccak256(abi.encode(agent, keccak256(bytes(merchantId)), maxAmount, validUntil))
        const merchantHash = ethers.keccak256(ethers.toUtf8Bytes(merchantId));

        const messageHash = ethers.solidityPackedKeccak256(
            ["bytes"],
            [ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "bytes32", "uint256", "uint256"],
                [signer.address, merchantHash, maxAmount, validUntil]
            )]
        );

        // Sign the binary hash directly -> toEthSignedMessageHash happens inside signMessage usually for string, 
        // but here we have bytes32. ethers wallet.signMessage treats string as utf8 bytes, Uint8Array as raw bytes.
        // To match ECDSA.toEthSignedMessageHash(messageHash) inside contract:
        // We need to sign the raw bytes of the messageHash.

        const signature = await signer.signMessage(ethers.getBytes(messageHash));
        return signature;
    }

    describe("Verification", function () {
        it("Should verify valid signature", async function () {
            const { verifier, agent } = await loadFixture(deployFixture);

            const merchantId = "merchant-1";
            const maxAmount = 100;
            const validUntil = (await time.latest()) + 3600;

            const signature = await signClaim(agent, merchantId, maxAmount, validUntil);

            const isValid = await verifier.verifyPolicyClaim(
                agent.address,
                merchantId,
                maxAmount,
                validUntil,
                signature
            );

            expect(isValid).to.be.true;
        });

        it("Should fail on expired claim", async function () {
            const { verifier, agent } = await loadFixture(deployFixture);

            const validUntil = (await time.latest()) - 3600; // expired
            const signature = await signClaim(agent, "m-1", 100, validUntil);

            const isValid = await verifier.verifyPolicyClaim(
                agent.address,
                "m-1",
                100,
                validUntil,
                signature
            );

            expect(isValid).to.be.false;
        });

        it("Should fail on wrong signer", async function () {
            const { verifier, agent, other } = await loadFixture(deployFixture);
            const validUntil = (await time.latest()) + 3600;

            // Signed by 'other' but claimed to be 'agent'
            const signature = await signClaim(other, "m-1", 100, validUntil);

            const isValid = await verifier.verifyPolicyClaim(
                agent.address, // We claim agent is the signer
                "m-1",
                100,
                validUntil,
                signature
            );

            expect(isValid).to.be.false;
        });

        it("Should fail on data tampering", async function () {
            const { verifier, agent } = await loadFixture(deployFixture);
            const validUntil = (await time.latest()) + 3600;

            const signature = await signClaim(agent, "m-1", 100, validUntil);

            // Change amount
            const isValid = await verifier.verifyPolicyClaim(
                agent.address,
                "m-1",
                200, // tampered
                validUntil,
                signature
            );

            expect(isValid).to.be.false;
        });
    });
});
