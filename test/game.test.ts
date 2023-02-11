import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";

describe("GAME", function () {
    async function deployGameFixture() {
        const ENTRY_FEE = parseEther("1");

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();
        const signers = await ethers.getSigners();

        const GAME_PERIOD = 300; //15 minutes
        const REVEAL_PERIOD = 300; //15 minutes
        const SALT = "1234";
        const Game = await ethers.getContractFactory("Game");
        const game = await Game.deploy(ENTRY_FEE, GAME_PERIOD, REVEAL_PERIOD);

        const secret = await game.createSecret("30", SALT);

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
            expect(await game.getDeployer()).to.equal(owner.address);
        });
    });
    describe("PickNumber", () => {
        it("It should revert if deadline is passed", async () => {
            const { GAME_PERIOD, game, secret } = await loadFixture(
                deployGameFixture
            );
            await time.increase(GAME_PERIOD);
            await expect(game.pickNumber(secret)).to.be.revertedWithCustomError(
                game,
                "GameEnded"
            );
        });
        it("Should revert player already picked a number", async () => {
            const { secret, game, ENTRY_FEE } = await loadFixture(
                deployGameFixture
            );
            await game.pickNumber(secret, { value: ENTRY_FEE });

            await expect(
                game.pickNumber(secret, { value: ENTRY_FEE })
            ).to.be.revertedWithCustomError(game, "NumberAlreadyPicked");
        });
        it("Should revert if entry fee is low", async () => {
            const { secret, game } = await loadFixture(deployGameFixture);
            await expect(game.pickNumber(secret)).to.be.revertedWithCustomError(
                game,
                "EntryFeeIsLow"
            );
        });
        it("Should update players array", async () => {
            const { secret, game, ENTRY_FEE } = await loadFixture(
                deployGameFixture
            );
            await game.pickNumber(secret, { value: ENTRY_FEE });
            expect(await game.getPlayersCount()).to.eq(1);
        });
    });
    describe("RevealNumber", () => {
        it("Should revert if reveal time is passed", async () => {
            const { REVEAL_PERIOD, GAME_PERIOD, game, secret, ENTRY_FEE } =
                await loadFixture(deployGameFixture);
            await game.pickNumber(secret, { value: ENTRY_FEE });
            await time.increase(GAME_PERIOD + REVEAL_PERIOD);

            await expect(
                game.revealNumber("30", "1234")
            ).to.be.revertedWithCustomError(game, "RevealTimeOver");
        });
        it("Should revert if number is less <=0 or greater than 100", async () => {
            const { game, secret, ENTRY_FEE, GAME_PERIOD } = await loadFixture(
                deployGameFixture
            );

            await game.pickNumber(secret, { value: ENTRY_FEE });
            await time.increase(GAME_PERIOD);
            await expect(
                game.revealNumber(0, "1234")
            ).to.be.revertedWithCustomError(game, "NumberOutOfRange");
        });
        it("Should revert of not a player", async () => {
            const { GAME_PERIOD, game, secret, ENTRY_FEE, otherAccount } =
                await loadFixture(deployGameFixture);
            await game.pickNumber(secret, { value: ENTRY_FEE });

            await time.increase(GAME_PERIOD);
            await expect(
                game.connect(otherAccount).revealNumber(30, "1234")
            ).to.be.revertedWithCustomError(game, "NotAPlayer");
        });
        it("Should revert if incorrect number or salt provider", async () => {
            const { game, secret, ENTRY_FEE, otherAccount, GAME_PERIOD } =
                await loadFixture(deployGameFixture);
            await game.pickNumber(secret, { value: ENTRY_FEE });
            await time.increase(GAME_PERIOD);
            await expect(
                game.revealNumber(32, "1234")
            ).to.be.revertedWithCustomError(game, "IncorrectNumberOrSalt");
        });
        it("Should revert if game is not over", async () => {
            const { game, secret, ENTRY_FEE, otherAccount, GAME_PERIOD } =
                await loadFixture(deployGameFixture);
            await game.pickNumber(secret, { value: ENTRY_FEE });
            await expect(
                game.revealNumber(30, "1234")
            ).to.be.revertedWithCustomError(game, "GameNotOver");
        });
        it("Should update the PlayertToNumberPicked mapping", async () => {
            const { game, secret, ENTRY_FEE, GAME_PERIOD, owner } =
                await loadFixture(deployGameFixture);
            await game.pickNumber(secret, { value: ENTRY_FEE });
            await time.increase(GAME_PERIOD);
            await game.revealNumber(30, "1234");
            expect(await game.playerToNumberPicked(owner.address)).to.eq(30);
        });
    });
});
