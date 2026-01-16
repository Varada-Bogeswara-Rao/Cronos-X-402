
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MerchantRegistry", function () {
    async function deployMerchantRegistryFixture() {
        const [deployer, merchantA, merchantB, randomUser] = await ethers.getSigners();
        const MerchantRegistry = await ethers.getContractFactory("MerchantRegistry");
        const registry = await MerchantRegistry.deploy();
        return { registry: registry as any, deployer, merchantA, merchantB, randomUser };
    }

    describe("Registration", function () {
        it("Should register a new merchant successfully", async function () {
            const { registry, merchantA } = await loadFixture(deployMerchantRegistryFixture);

            const merchantId = "merchant-123";
            const metadata = "ipfs://QmHash";

            await expect(registry.connect(merchantA).registerMerchant(merchantId, metadata))
                .to.emit(registry, "MerchantRegistered")
                .withArgs(merchantId, merchantA.address, metadata, (val: any) => val > 0);

            const m = await registry.getMerchant(merchantId);
            expect(m.wallet).to.equal(merchantA.address);
            expect(m.isActive).to.be.true;
            expect(m.metadataURI).to.equal(metadata);
        });

        it("Should prevent duplicate merchant IDs", async function () {
            const { registry, merchantA, merchantB } = await loadFixture(deployMerchantRegistryFixture);
            await registry.connect(merchantA).registerMerchant("id-1", "meta-1");

            await expect(registry.connect(merchantB).registerMerchant("id-1", "meta-2"))
                .to.be.revertedWithCustomError(registry, "MerchantAlreadyExists");
        });

        it("Should prevent one wallet from registering multiple merchants", async function () {
            const { registry, merchantA } = await loadFixture(deployMerchantRegistryFixture);
            await registry.connect(merchantA).registerMerchant("id-1", "meta-1");

            await expect(registry.connect(merchantA).registerMerchant("id-2", "meta-2"))
                .to.be.revertedWithCustomError(registry, "MerchantAlreadyExists");
        });

        it("Should allow reverse lookup", async function () {
            const { registry, merchantA } = await loadFixture(deployMerchantRegistryFixture);
            await registry.connect(merchantA).registerMerchant("id-lookup", "meta");

            expect(await registry.getMerchantIdByWallet(merchantA.address)).to.equal("id-lookup");
        });
    });

    describe("Management", function () {
        it("Should allow merchant to update metadata", async function () {
            const { registry, merchantA } = await loadFixture(deployMerchantRegistryFixture);
            await registry.connect(merchantA).registerMerchant("id-1", "meta-1");

            await expect(registry.connect(merchantA).updateMerchant("id-1", "meta-new"))
                .to.emit(registry, "MerchantUpdated")
                .withArgs("id-1", "meta-new", (val: any) => val > 0);

            const m = await registry.getMerchant("id-1");
            expect(m.metadataURI).to.equal("meta-new");
        });

        it("Should prevent unauthorized updates", async function () {
            const { registry, merchantA, merchantB } = await loadFixture(deployMerchantRegistryFixture);
            await registry.connect(merchantA).registerMerchant("id-1", "meta-1");

            await expect(registry.connect(merchantB).updateMerchant("id-1", "hack"))
                .to.be.revertedWithCustomError(registry, "Unauthorized");
        });

        it("Should allow merchant to deactivate", async function () {
            const { registry, merchantA } = await loadFixture(deployMerchantRegistryFixture);
            await registry.connect(merchantA).registerMerchant("id-1", "meta-1");

            await registry.connect(merchantA).deactivateMerchant("id-1");
            const m = await registry.getMerchant("id-1");
            expect(m.isActive).to.be.false;
        });
    });
});
