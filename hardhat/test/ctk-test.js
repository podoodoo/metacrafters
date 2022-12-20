const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect, assert } = require("chai")
const { ethers, upgrades } = require("hardhat")
const { hre } = require("hardhat")

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
        const customTokenV2 = await upgrades.upgradeProxy(
            customToken,
            customTokenV2Factory,
            { kind: "uups" }
        )

        await customTokenV2.deployed()

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
        it("Should have no initial tokens for contract", async function () {
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

            const [id, goal, , , active, recipient] =
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
            const { customTokenV2, account1 } = await loadFixture(
                deployCustomTokenFixture
            )
            await customTokenV2.connect(account1).claim()

            expect(await customTokenV2.connect(account1))
        })
    })

    // describe("Withdrawals", function () {
    //     describe("Validations", function () {
    //         it("Should revert with the right error if called too soon", async function () {
    //             const { lock } = await loadFixture(deployOneYearLockFixture)

    //             await expect(lock.withdraw()).to.be.revertedWith(
    //                 "You can't withdraw yet"
    //             )
    //         })

    //         it("Should revert with the right error if called from another account", async function () {
    //             const { lock, unlockTime, otherAccount } = await loadFixture(
    //                 deployOneYearLockFixture
    //             )

    //             // We can increase the time in Hardhat Network
    //             await time.increaseTo(unlockTime)

    //             // We use lock.connect() to send a transaction from another account
    //             await expect(
    //                 lock.connect(otherAccount).withdraw()
    //             ).to.be.revertedWith("You aren't the owner")
    //         })

    //         it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
    //             const { lock, unlockTime } = await loadFixture(
    //                 deployOneYearLockFixture
    //             )

    //             // Transactions are sent using the first signer by default
    //             await time.increaseTo(unlockTime)

    //             await expect(lock.withdraw()).not.to.be.reverted
    //         })
    //     })

    //     describe("Events", function () {
    //         it("Should emit an event on withdrawals", async function () {
    //             const { lock, unlockTime, lockedAmount } = await loadFixture(
    //                 deployOneYearLockFixture
    //             )

    //             await time.increaseTo(unlockTime)

    //             await expect(lock.withdraw())
    //                 .to.emit(lock, "Withdrawal")
    //                 .withArgs(lockedAmount, anyValue) // We accept any value as `when` arg
    //         })
    //     })

    //     describe("Transfers", function () {
    //         it("Should transfer the funds to the owner", async function () {
    //             const { lock, unlockTime, lockedAmount, owner } =
    //                 await loadFixture(deployOneYearLockFixture)

    //             await time.increaseTo(unlockTime)

    //             await expect(lock.withdraw()).to.changeEtherBalances(
    //                 [owner, lock],
    //                 [lockedAmount, -lockedAmount]
    //             )
    //         })
    //     })
    // })
})
