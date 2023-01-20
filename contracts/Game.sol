// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "hardhat/console.sol";

error EntryFeeCannotBeZero();
error GameNotStarted();
error GameAlreadyStarted();
error EntryFeeIsLow();
error NumberOutOfRange();
error NotAPlayer();
error GameEnded();
error NumberAlreadyPicked();
error GameNotOver();

contract Game {
    event GameJoined(address player, uint256 entryFee);
    event NumberPicked(address player, uint256 number);
    event Winner(address winner, uint256 numberPicked);

    uint256 immutable gameDelay;
    uint256 immutable gamePeriod;
    uint256 immutable entryFee;
    address immutable deployer;

    address[] public players;
    mapping(address => uint256) public playerToNumberPicked;

    constructor(uint256 _entryFee) payable {
        if (_entryFee == 0) revert EntryFeeCannotBeZero();
        deployer = msg.sender;
        gameDelay = block.timestamp + 600; // 10 minutes
        gamePeriod = gameDelay + 300; // 15 minutes
        entryFee = _entryFee;
    }

    function joinGame() external payable {
        if (block.timestamp >= gameDelay) revert GameAlreadyStarted();
        if (msg.value < entryFee) revert EntryFeeIsLow();
        players.push(msg.sender);
        emit GameJoined(msg.sender, msg.value);
    }

    function pickNumber(uint256 _number) external {
        address[] memory _players = players;
        uint256 _playersLength = _players.length;
        for (uint256 i = 0; i < _playersLength; i++) {
            if (_players[i] == msg.sender) {
                if (playerToNumberPicked[msg.sender] != 0)
                    revert NumberAlreadyPicked();
                if (block.timestamp <= gameDelay) revert GameNotStarted();
                if (block.timestamp >= gamePeriod) revert GameEnded();
                if (_number > 100 || _number <= 0) revert NumberOutOfRange();
                playerToNumberPicked[msg.sender] = _number;
                emit NumberPicked(msg.sender, _number);
                return;
            }
        }
        revert NotAPlayer();
    }

    function getWinner() external {
        if (block.timestamp <= gameDelay) revert GameNotStarted();
        if (block.timestamp <= gamePeriod) revert GameNotOver();
        address[] memory _players = players;
        uint256 _playersLength = _players.length;
        uint256 _total;
        uint256 result;
        uint256 _winnerNumber = 0;
        address _winner;
        for (uint256 i = 0; i < _playersLength; i++) {
            _total += playerToNumberPicked[_players[i]];
        }
        result = ((_total / _playersLength)) * 80; // divide this by 100
        // pick a player who chooses closest to the result
        if (playerToNumberPicked[_players[0]] > result / 100) {
            _winnerNumber = playerToNumberPicked[_players[0]] - result / 100;
            _winner = _players[0];
        } else {
            _winnerNumber = result - playerToNumberPicked[_players[0]] / 100;
            _winner = _players[0];
        }

        for (uint256 i = 0; i < _playersLength; i++) {
            if (
                playerToNumberPicked[_players[i]] > result / 100 &&
                playerToNumberPicked[_players[i]] - result / 100 < _winnerNumber
            ) {
                _winnerNumber =
                    playerToNumberPicked[_players[i]] -
                    result /
                    100;
                _winner = _players[i];
            } else if (
                playerToNumberPicked[_players[i]] < result / 100 &&
                result - playerToNumberPicked[_players[i]] / 100 < _winnerNumber
            ) {
                _winnerNumber =
                    result -
                    playerToNumberPicked[_players[i]] /
                    100;
                _winner = _players[i];
            }
        }
        emit Winner(_winner, playerToNumberPicked[_winner]);
    }

    // view/pure functions

    function getGameDelay() external view returns (uint256) {
        return gameDelay;
    }

    function getGamePeriod() external view returns (uint256) {
        return gamePeriod;
    }

    function getEntryFee() external view returns (uint256) {
        return entryFee;
    }

    function getDeployer() external view returns (address) {
        return deployer;
    }

    function getPlayersCount() external view returns (uint256) {
        return players.length;
    }

    function getPlayerNumber(address _player) external view returns (uint256) {
        return playerToNumberPicked[_player];
    }
}
