const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect, assert } = require("chai")
const { ethers, upgrades } = require("hardhat")

describe("CustomToken", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployCustomTokenFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, account1, account2] = await ethers.getSigners()

        const customTokenFactory = await ethers.getContractFactory(
            "CustomToken"
        )
        const customTokenV2Factory = await ethers.getContractFactory(
            "CustomTokenV2"
        )

        const customToken = await upgrades.deployProxy(customTokenFactory, [], {
            initializer: "initialize",
            kind: "uups"
        })

        await customToken.deployed()

        const customTokenV2 = await upgrades.upgradeProxy(
            customToken,
            customTokenV2Factory,
            { kind: "uups" }
        )

        const token = await customTokenV2.deployed()
        token.approve()
        return { customToken, customTokenV2, owner, account1, account2 }
    }

    describe("Deployment", function () {
        it("Should set owner to Custom Token contracts", async function () {
            const { customToken, customTokenV2, owner } = await loadFixture(
                deployCustomTokenFixture
            )
            expect(await customToken.owner()).to.equal(owner.address)
            expect(await customTokenV2.owner()).to.equal(owner.address)
        })
    })

    describe("Tokenomics", function () {
        it("Should mint 100 CTK to `account1` and `account2`", async function () {
            const { customTokenV2, account1, account2 } = await loadFixture(
                deployCustomTokenFixture
            )

            await customTokenV2.connect(account1).claim()
            expect(await customTokenV2.balanceOf(account1.address)).to.equal(
                100
            )
            await customTokenV2.connect(account2).claim()
            expect(await customTokenV2.balanceOf(account2.address)).to.equal(
                100
            )
        })
        it("Should have no tokens for contract", async function () {
            const { customToken, customTokenV2 } = await loadFixture(
                deployCustomTokenFixture
            )

            expect(await customToken.balanceOf(customToken.address)).to.equal(0)
            expect(
                await customTokenV2.balanceOf(customTokenV2.address)
            ).to.equal(0)
        })
    })
    describe("Proposals", function () {
        it("Should create a proposal", async function () {
            const { customTokenV2, account1 } = await loadFixture(
                deployCustomTokenFixture
            )

            await customTokenV2.createProposal(10, account1.address)

            const [id, goal, , , recipient, active] =
                await customTokenV2.proposals(0)
            expect(id.toNumber()).to.equal(0)
            expect(goal.toNumber()).to.equal(10)
            expect(recipient).to.equal(account1.address)
            expect(active).to.be.true
        })
        it("Should update a proposal when pledged", async function () {
            const { customTokenV2, account1 } = await loadFixture(
                deployCustomTokenFixture
            )

            await customTokenV2.createProposal(10, account1.address)

            const [id, goal] = await customTokenV2.proposals(0)
            expect((await customTokenV2.numProposals()).toNumber()).to.equal(1)
            expect(id.toNumber()).to.equal(0)
            expect(goal.toNumber()).to.equal(10)
        })
    })

    describe("Transactions", function () {
        it("Should pledge tokens from account1", async function () {
            const { customTokenV2, account1, account2 } = await loadFixture(
                deployCustomTokenFixture
            )

            await customTokenV2.createProposal(10, account2.address)
            await customTokenV2.connect(account1).claim()
            await customTokenV2.connect(account1).pledge(0, 5)
            expect(await customTokenV2.getPledge(0, account1.address)).to.equal(
                5
            )
        })
        it("Should cancel a proposal and refund tokens", async function () {
            const { customTokenV2, account1, account2 } = await loadFixture(
                deployCustomTokenFixture
            )
            await customTokenV2.createProposal(10, account2.address)
            await customTokenV2.connect(account1).claim()
            await customTokenV2.connect(account1).pledge(0, 5)
            await customTokenV2.endProposal(0)

            expect(await customTokenV2.balanceOf(account1.address)).to.equal(
                100
            )
        })
        it("Should end a proposal and disburse tokens", async function () {
            const { customTokenV2, account1, account2 } = await loadFixture(
                deployCustomTokenFixture
            )
            await customTokenV2.createProposal(10, account2.address)
            await customTokenV2.connect(account1).claim()
            await customTokenV2.connect(account1).pledge(0, 10)
            await customTokenV2.endProposal(0)

            expect(await customTokenV2.balanceOf(account2.address)).to.equal(10)
        })
    })

    describe("Events", function () {
        it("Should emit an event when tokens are claimed", async function () {
            const { customTokenV2, account1 } = await loadFixture(
                deployCustomTokenFixture
            )

            expect(await customTokenV2.connect(account1).claim())
                .to.emit(customTokenV2, "TokensClaimed")
                .withArgs(account1.address)
        })
        it("Should emit an event when a Proposal is created", async function () {
            const { customTokenV2, account1 } = await loadFixture(
                deployCustomTokenFixture
            )

            expect(await customTokenV2.createProposal(10, account1.address))
                .to.emit(customTokenV2, "ProposalCreated")
                .withArgs(0, 10, account1.address)
        })
        it("Should emit an event when tokens are pledged to a Proposal", async function () {
            const { customTokenV2, account1, account2 } = await loadFixture(
                deployCustomTokenFixture
            )

            await customTokenV2.createProposal(10, account2.address)
            await customTokenV2.connect(account1).claim()
            expect(await customTokenV2.connect(account1).pledge(0, 5))
                .to.emit(customTokenV2, "TokensPledged")
                .withArgs(account1.address, 5)
        })
        it("Should emit an event when a Proposal is cancelled", async function () {
            const { customTokenV2, account1, account2 } = await loadFixture(
                deployCustomTokenFixture
            )
            await customTokenV2.createProposal(10, account2.address)
            await customTokenV2.connect(account1).claim()
            await customTokenV2.connect(account1).pledge(0, 5)
            expect(await customTokenV2.endProposal(0))
                .to.emit(customTokenV2, "ProposalCancelled")
                .withArgs(0)
        })
        it("Should emit an event when a Proposal is disbursed", async function () {
            const { customTokenV2, account1, account2 } = await loadFixture(
                deployCustomTokenFixture
            )
            await customTokenV2.createProposal(10, account2.address)
            await customTokenV2.connect(account1).claim()
            await customTokenV2.connect(account1).pledge(0, 10)
            expect(await customTokenV2.endProposal(0))
                .to.emit(customTokenV2, "ProposalDisbursed")
                .withArgs(0, 10, account2.address)
        })
    })
})
