
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("AgentPolicyRegistry", function () {
    async function deployFixture() {
        const [deployer, agentA, agentB] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("AgentPolicyRegistry");
        const registry = await Factory.deploy();
        return { registry: registry as any, deployer, agentA, agentB };
    }

    describe("Policy Management", function () {
        it("Should emit PolicySet on first update", async function () {
            const { registry, agentA } = await loadFixture(deployFixture);
            const limit = 1000;
            const txLimit = 100;
            const hash = ethers.id("config-json");

            await expect(registry.connect(agentA).setPolicy(limit, txLimit, hash))
                .to.emit(registry, "PolicySet")
                .withArgs(agentA.address, limit, txLimit, hash, (val: any) => val > 0);

            const p = await registry.getPolicy(agentA.address);
            expect(p.dailySpendLimit).to.equal(limit);
            expect(p.isFrozen).to.be.false;
        });

        it("Should emit PolicyUpdated on subsequent updates", async function () {
            const { registry, agentA } = await loadFixture(deployFixture);
            const hash = ethers.id("config-json");

            // First set
            await registry.connect(agentA).setPolicy(1000, 100, hash);

            // Update
            await expect(registry.connect(agentA).setPolicy(2000, 200, hash))
                .to.emit(registry, "PolicyUpdated")
                .withArgs(agentA.address, 2000, 200, hash, (val: any) => val > 0);
        });

        it("Should revert invalid params (max > daily)", async function () {
            const { registry, agentA } = await loadFixture(deployFixture);
            await expect(registry.connect(agentA).setPolicy(100, 200, ethers.id("x")))
                .to.be.revertedWithCustomError(registry, "InvalidPolicyParams");
        });

        it("Should revert invalid params (zero limit)", async function () {
            const { registry, agentA } = await loadFixture(deployFixture);
            await expect(registry.connect(agentA).setPolicy(0, 0, ethers.id("x")))
                .to.be.revertedWithCustomError(registry, "InvalidPolicyParams");
        });

        it("Should freeze policy", async function () {
            const { registry, agentA } = await loadFixture(deployFixture);
            await registry.connect(agentA).setPolicy(1000, 100, ethers.id("x"));

            await expect(registry.connect(agentA).freezePolicy())
                .to.emit(registry, "PolicyFrozen")
                .withArgs(agentA.address, (val: any) => val > 0);

            const p = await registry.getPolicy(agentA.address);
            expect(p.isFrozen).to.be.true;
        });

        it("Should unfreeze on setPolicy", async function () {
            const { registry, agentA } = await loadFixture(deployFixture);
            await registry.connect(agentA).setPolicy(1000, 100, ethers.id("x"));
            await registry.connect(agentA).freezePolicy();

            // Unfreeze via setPolicy
            await registry.connect(agentA).setPolicy(1000, 100, ethers.id("x"));
            const p = await registry.getPolicy(agentA.address);
            expect(p.isFrozen).to.be.false;
        });
    });
});
