import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";

describe("GAME", function () {
    async function deployGameFixture() {
        const TEN_MINUTES = 600;
        const ENTRY_FEE = parseEther("1");

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();
        const signers = await ethers.getSigners();

        const Game = await ethers.getContractFactory("Game");
        const game = await Game.deploy(ENTRY_FEE);

        const GAME_DELAY = (await time.latest()) + TEN_MINUTES;
        const GAME_PERIOD = GAME_DELAY + 300; //15 minutes

        return {
            GAME_DELAY,
            GAME_PERIOD,
            ENTRY_FEE,
            owner,
            otherAccount,
            game,
            signers,
        };
    }

    describe("Deployment", function () {
        it("Should set the right state variables", async function () {
            const { GAME_DELAY, GAME_PERIOD, ENTRY_FEE, game, owner } =
                await loadFixture(deployGameFixture);
            expect(await game.getGameDelay()).to.equal(GAME_DELAY);
            expect(await game.getGamePeriod()).to.equal(GAME_PERIOD);
            expect(await game.getEntryFee()).to.equal(ENTRY_FEE);
            expect(await game.getDeployer()).to.equal(owner.address);
        });
    });
    describe("Join Game", () => {
        it("Should not allow to join after game starts", async () => {
            const { game } = await loadFixture(deployGameFixture);
            await ethers.provider.send("evm_increaseTime", [600]);
            await expect(game.joinGame()).to.be.revertedWithCustomError(
                game,
                "GameAlreadyStarted"
            );
        });
        it("Should fail if entry fee is less then required", async () => {
            const { game, otherAccount } = await loadFixture(deployGameFixture);
            await expect(
                game.connect(otherAccount).joinGame({ value: 0 })
            ).to.be.revertedWithCustomError(game, "EntryFeeIsLow");
        });
        it("Should update the players array", async () => {
            const { game, otherAccount } = await loadFixture(deployGameFixture);
            await game
                .connect(otherAccount)
                .joinGame({ value: parseEther("1") });
            expect(await game.getPlayersCount()).to.equal(1);
        });
        it("Should emit a PlayerJoined event", async () => {
            const { game, otherAccount, ENTRY_FEE } = await loadFixture(
                deployGameFixture
            );
            await expect(
                game.connect(otherAccount).joinGame({ value: parseEther("1") })
            )
                .to.emit(game, "GameJoined")
                .withArgs(otherAccount.address, ENTRY_FEE);
        });
    });
    describe("Pick Number", () => {
        it("Should not allow to pick before game starts", async () => {
            const { game } = await loadFixture(deployGameFixture);
            await game.joinGame({ value: parseEther("1") });
            await expect(game.pickNumber(1)).to.be.revertedWithCustomError(
                game,
                "GameNotStarted"
            );
        });
        it("Should not allow to pick after game ends", async () => {
            const { game } = await loadFixture(deployGameFixture);
            await game.joinGame({ value: parseEther("1") });
            await ethers.provider.send("evm_increaseTime", [900]);
            await expect(game.pickNumber(1)).to.be.revertedWithCustomError(
                game,
                "GameEnded"
            );
        });
        it("Should not allow to pick number out of range", async () => {
            const { game } = await loadFixture(deployGameFixture);
            await game.joinGame({ value: parseEther("1") });
            await ethers.provider.send("evm_increaseTime", [600]);
            await expect(game.pickNumber(0)).to.be.revertedWithCustomError(
                game,
                "NumberOutOfRange"
            );
            await expect(game.pickNumber(101)).to.be.revertedWithCustomError(
                game,
                "NumberOutOfRange"
            );
        });
        it("Should revert if not a player", async () => {
            const { game, otherAccount } = await loadFixture(deployGameFixture);
            await ethers.provider.send("evm_increaseTime", [600]);
            await expect(
                game.connect(otherAccount).pickNumber(1)
            ).to.be.revertedWithCustomError(game, "NotAPlayer");
        });
        it("Should not allow to pick number twice", async () => {
            const { game, owner } = await loadFixture(deployGameFixture);
            await game.joinGame({ value: parseEther("1") });
            await ethers.provider.send("evm_increaseTime", [600]);
            await game.pickNumber(1);
            await expect(game.pickNumber(1)).to.be.revertedWithCustomError(
                game,
                "NumberAlreadyPicked"
            );
        });
        it("Should Allow to pick and update playerToNumber mapping", async () => {
            const { game, owner } = await loadFixture(deployGameFixture);
            await game.joinGame({ value: parseEther("1") });
            await ethers.provider.send("evm_increaseTime", [600]);
            await game.pickNumber(1);
            expect(await game.getPlayerNumber(owner.address)).to.equal(1);
        });
        it("Should emit a NumberPicked event", async () => {
            const { game, owner } = await loadFixture(deployGameFixture);
            await game.joinGame({ value: parseEther("1") });
            await ethers.provider.send("evm_increaseTime", [600]);
            await expect(game.pickNumber(1))
                .to.emit(game, "NumberPicked")
                .withArgs(owner.address, 1);
        });
    });
    describe("Get Winner", () => {
        it("Should revert if game is not ended", async () => {
            const { game } = await loadFixture(deployGameFixture);
            await game.joinGame({ value: parseEther("1") });
            await ethers.provider.send("evm_increaseTime", [600]);
            await expect(game.getWinner()).to.be.revertedWithCustomError(
                game,
                "GameNotOver"
            );
        });
        it("Should revert if game not started", async () => {
            const { game } = await loadFixture(deployGameFixture);
            await expect(game.getWinner()).to.be.revertedWithCustomError(
                game,
                "GameNotStarted"
            );
        });
        it("should emit even with winner address and number if game is ended", async () => {
            const { game, owner, signers } = await loadFixture(
                deployGameFixture
            );
            await game.joinGame({ value: parseEther("1") });
            await game.connect(signers[1]).joinGame({ value: parseEther("1") });
            await game.connect(signers[2]).joinGame({ value: parseEther("1") });
            await game.connect(signers[3]).joinGame({ value: parseEther("1") });
            await ethers.provider.send("evm_increaseTime", [600]);
            await game.pickNumber(5);
            await game.connect(signers[1]).pickNumber(10);
            await game.connect(signers[2]).pickNumber(15);
            await game.connect(signers[3]).pickNumber(35);
            await ethers.provider.send("evm_increaseTime", [300]);
            await expect(game.getWinner())
                .to.emit(game, "Winner")
                .withArgs(signers[3].address, 15);
            // TODO: There is some Decimal gotcha here need to fix this
        });
    });
});
