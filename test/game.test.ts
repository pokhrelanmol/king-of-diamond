import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
const getHashedMove = (_number: number, _salt: string) => {
    const hashedMove = ethers.utils.solidityKeccak256(
        ["uint256", "bytes32"],
        [_number, _salt]
    );
    return hashedMove;
};
describe("GAME", function () {
    async function deployGameFixture() {
        const ENTRY_FEE = parseEther("1");

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();
        const signers = await ethers.getSigners();

        const GAME_PERIOD = 300; //15 minutes
        const REVEAL_PERIOD = 300; //15 minutes
        const SALT = ethers.utils.id("1234");
        const Game = await ethers.getContractFactory("Game");
        const game = await Game.deploy(ENTRY_FEE, GAME_PERIOD, REVEAL_PERIOD);

        const secret = await game.createSecret(30, SALT);

        return {
            REVEAL_PERIOD,
            GAME_PERIOD,
            ENTRY_FEE,
            SALT,
            owner,
            otherAccount,
            game,
            secret,
            signers,
        };
    }

    describe("Deployment", function () {
        it("Should set the right state variables", async function () {
            const { REVEAL_PERIOD, GAME_PERIOD, ENTRY_FEE, game, owner } =
                await loadFixture(deployGameFixture);
            expect(await game.getEntryFee()).to.equal(ENTRY_FEE);
        });
    });
    describe("PickNumber", () => {
        it("It should revert if deadline is passed", async () => {
            const { GAME_PERIOD, game, secret, SALT } = await loadFixture(
                deployGameFixture
            );
            await time.increase(GAME_PERIOD);
            const hashedMove = getHashedMove(30, SALT);
            await expect(
                game.pickNumber(hashedMove)
            ).to.be.revertedWithCustomError(game, "GameEnded");
        });
        it("Should revert player already picked a number", async () => {
            const { secret, game, ENTRY_FEE, SALT } = await loadFixture(
                deployGameFixture
            );
            const hashedMove = getHashedMove(30, SALT);
            await game.pickNumber(hashedMove, { value: ENTRY_FEE });

            await expect(
                game.pickNumber(secret, { value: ENTRY_FEE })
            ).to.be.revertedWithCustomError(game, "NumberAlreadyPicked");
        });
        it("Should revert if entry fee is low", async () => {
            const { secret, game, SALT } = await loadFixture(deployGameFixture);
            const hashedMove = getHashedMove(30, SALT);
            await expect(
                game.pickNumber(hashedMove)
            ).to.be.revertedWithCustomError(game, "EntryFeeIsLow");
        });
        it("Should update players array", async () => {
            const { secret, game, ENTRY_FEE, SALT } = await loadFixture(
                deployGameFixture
            );
            const hashedMove = getHashedMove(30, SALT);
            await game.pickNumber(hashedMove, { value: ENTRY_FEE });
            expect(await game.getPlayersCount()).to.eq(1);
        });
    });
    describe("RevealNumber", () => {
        it("Should revert if reveal time is passed", async () => {
            const {
                REVEAL_PERIOD,
                GAME_PERIOD,
                SALT,
                game,
                secret,
                ENTRY_FEE,
            } = await loadFixture(deployGameFixture);
            await game.pickNumber(secret, { value: ENTRY_FEE });
            await time.increase(GAME_PERIOD + REVEAL_PERIOD);

            await expect(
                game.revealNumber(30, SALT)
            ).to.be.revertedWithCustomError(game, "RevealTimeOver");
        });
        it("Should revert if number is less <=0 or greater than 100", async () => {
            const { game, secret, ENTRY_FEE, GAME_PERIOD, SALT } =
                await loadFixture(deployGameFixture);
            const hashedMove = getHashedMove(0, SALT);
            await game.pickNumber(hashedMove, { value: ENTRY_FEE });
            await time.increase(GAME_PERIOD);
            await expect(
                game.revealNumber(0, SALT)
            ).to.be.revertedWithCustomError(game, "NumberOutOfRange");
        });
        it("Should revert of not a player", async () => {
            const { GAME_PERIOD, game, secret, ENTRY_FEE, otherAccount, SALT } =
                await loadFixture(deployGameFixture);
            const hashedMove = getHashedMove(30, SALT);
            await game.pickNumber(hashedMove, { value: ENTRY_FEE });

            await time.increase(GAME_PERIOD);
            await expect(
                game.connect(otherAccount).revealNumber(30, SALT)
            ).to.be.revertedWithCustomError(game, "NotAPlayer");
        });
        it("Should revert if incorrect number or salt provider", async () => {
            const { game, secret, ENTRY_FEE, otherAccount, GAME_PERIOD, SALT } =
                await loadFixture(deployGameFixture);
            const hashedMove = getHashedMove(30, SALT);
            await game.pickNumber(hashedMove, { value: ENTRY_FEE });
            await time.increase(GAME_PERIOD);
            await expect(
                game.revealNumber(32, SALT)
            ).to.be.revertedWithCustomError(game, "IncorrectNumberOrSalt");
        });
        it("Should revert if game is not over", async () => {
            const { game, secret, ENTRY_FEE, SALT, otherAccount, GAME_PERIOD } =
                await loadFixture(deployGameFixture);
            const hashedMove = getHashedMove(30, SALT);
            await game.pickNumber(hashedMove, { value: ENTRY_FEE });
            await expect(
                game.revealNumber(30, SALT)
            ).to.be.revertedWithCustomError(game, "GameNotOver");
        });
        it("Should update the PlayertToNumberPicked mapping", async () => {
            const { game, secret, ENTRY_FEE, SALT, GAME_PERIOD, owner } =
                await loadFixture(deployGameFixture);
            const hashedMove = getHashedMove(30, SALT);
            await game.pickNumber(hashedMove, {
                value: ENTRY_FEE,
            });
            await time.increase(GAME_PERIOD);
            await game.revealNumber(30, SALT);
            expect(await game.playerToNumberPicked(owner.address)).to.eq(30);
        });
        it("Should update playersRevealed Array", async () => {
            const { game, secret, ENTRY_FEE, SALT, GAME_PERIOD, owner } =
                await loadFixture(deployGameFixture);
            const hashedMove = getHashedMove(30, SALT);
            await game.pickNumber(hashedMove, {
                value: ENTRY_FEE,
            });
            await time.increase(GAME_PERIOD);
            await game.revealNumber(30, SALT);
            expect(await game.getRevealedPlayersCount()).to.eq(1);
        });
    });
    describe("Get Winner", () => {
        // it("Should choose signer1 as winner", async () => {
        //     const {
        //         game,
        //         secret,
        //         ENTRY_FEE,
        //         SALT,
        //         GAME_PERIOD,
        //         owner,
        //         signers,
        //     } = await loadFixture(deployGameFixture);
        //     const hashedMove1 = getHashedMove(44, SALT);
        //     const hashedMove2 = getHashedMove(30, SALT);
        //     const hashedMove3 = getHashedMove(40, SALT);
        //     const hashedMove4 = getHashedMove(10, SALT);
        //     await game.pickNumber(hashedMove1, {
        //         value: ENTRY_FEE,
        //     });
        //     await game.connect(signers[1]).pickNumber(hashedMove2, {
        //         value: ENTRY_FEE,
        //     });
        //     await game.connect(signers[2]).pickNumber(hashedMove3, {
        //         value: ENTRY_FEE,
        //     });
        //     await game.connect(signers[3]).pickNumber(hashedMove4, {
        //         value: ENTRY_FEE,
        //     });

        //     await time.increase(GAME_PERIOD);
        //     await game.revealNumber(44, SALT);
        //     await game.connect(signers[1]).revealNumber(30, SALT);
        //     await game.connect(signers[2]).revealNumber(40, SALT);
        //     const tx = await game.connect(signers[3]).revealNumber(10, SALT);
        //     const receipt = await tx.wait();
        //     console.lo g(receipt.events);
        //     await expect(tx)
        //         .to.emit(game, "Winner")
        //         .withArgs(signers[1].address, 30);
        // });
        it("Get appropriate winner without flooring", async () => {
            const {
                game,
                secret,
                ENTRY_FEE,
                SALT,
                GAME_PERIOD,
                owner,
                signers,
            } = await loadFixture(deployGameFixture);
            const hashedMove1 = getHashedMove(3, SALT);
            const hashedMove2 = getHashedMove(4, SALT);
            const hashedMove3 = getHashedMove(5, SALT);
            const hashedMove4 = getHashedMove(7, SALT);
            await game.pickNumber(hashedMove1, {
                value: ENTRY_FEE,
            });
            await game.connect(signers[1]).pickNumber(hashedMove2, {
                value: ENTRY_FEE,
            });
            await game.connect(signers[2]).pickNumber(hashedMove3, {
                value: ENTRY_FEE,
            });
            await game.connect(signers[3]).pickNumber(hashedMove4, {
                value: ENTRY_FEE,
            });

            await time.increase(GAME_PERIOD);
            await game.revealNumber(3, SALT);
            await game.connect(signers[1]).revealNumber(4, SALT);
            await game.connect(signers[2]).revealNumber(5, SALT);
            const tx = await game.connect(signers[3]).revealNumber(7, SALT);
            expect(tx).to.emit(game, "Winner").withArgs(signers[1].address, 4);
        });
    });
});
