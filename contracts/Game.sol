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
error RevealTimeOver();
error IncorrectNumberOrSalt();

contract Game {
    event GameJoined(address player, uint256 entryFee);
    event NumberPicked(address player, uint256 number);
    event Winner(address winner, uint256 numberPicked);

    //TODO: compact variables to uint 32
    uint256 public immutable gameDeadline;
    uint256 public immutable revealNumberDeadline;
    // convert to uint112
    uint160 public immutable entryFee;
    address public immutable deployer;

    address[] public players;
    mapping(address => bytes32) public playerToSecret;

    address[] public playersRevealed;
    mapping(address => uint256) public playerToNumberPicked;

    constructor(
        uint256 _entryFee,
        uint256 gamePeriod,
        uint256 revealPeriod
    ) payable {
        if (_entryFee == 0) revert EntryFeeCannotBeZero();
        deployer = msg.sender;

        gameDeadline = block.timestamp + gamePeriod;
        revealNumberDeadline = gameDeadline + revealPeriod;
        entryFee = uint160(_entryFee);
    }

    function _isPlayer(address player) internal returns (bool isPlayer) {
        if (playerToSecret[player] != 0) {
            return true;
        }
        return false;
    }

    function pickNumber(bytes32 _secret) external payable {
        if (block.timestamp >= gameDeadline) revert GameEnded(); // this will avoid front running
        if (_isPlayer(msg.sender)) revert NumberAlreadyPicked();
        if (msg.value < entryFee) revert EntryFeeIsLow();
        players.push(msg.sender);
        playerToSecret[msg.sender] = _secret;
        // Caviate: if number is greater then 100 we can't really check it here but we can kick the player out and seize the entry fee if it is not in range at reveal time
    }

    function revealNumber(uint8 _number, bytes32 _salt) external {
        if (!_isPlayer(msg.sender)) revert NotAPlayer();
        if (_number > 100 || _number <= 0) revert NumberOutOfRange();
        if (block.timestamp < gameDeadline) revert GameNotOver();
        if (block.timestamp > revealNumberDeadline) revert RevealTimeOver();
        if (
            keccak256(abi.encodePacked(_number, _salt)) !=
            playerToSecret[msg.sender]
        ) revert IncorrectNumberOrSalt();
        playerToNumberPicked[msg.sender] = _number;
        playersRevealed.push(msg.sender);
        // last to call this function will also call getWinner function

        if (playersRevealed.length == players.length) {
            getWinner();
        }
    }

    function getWinner() public {
        if (block.timestamp <= gameDeadline) revert GameNotOver();
        address[] memory _playersRevealed = playersRevealed;
        uint256 _total;
        uint256 result;
        uint256 _winnerNumber;
        address _winner;
        for (uint256 i; i < _playersRevealed.length; i++) {
            _total += playerToNumberPicked[_playersRevealed[i]]; // add all numbers
        }
        result = ((_total / _playersRevealed.length) * 80); // divide this by 100
        // pick a player who chooses closest to the result
        address firstPlayer = _playersRevealed[0];
        if (playerToNumberPicked[firstPlayer] > result) {
            _winnerNumber = playerToNumberPicked[firstPlayer] - result;
            _winner = firstPlayer;
        } else {
            _winnerNumber = result - playerToNumberPicked[firstPlayer];
            _winner = firstPlayer;
        }

        for (uint256 i = 0; i < _playersRevealed.length; i++) {
            address _player = _playersRevealed[i];
            if (
                playerToNumberPicked[_player] > result &&
                playerToNumberPicked[_player] - result < _winnerNumber
            ) {
                _winnerNumber = playerToNumberPicked[_player] - result;
                _winner = _player;
            } else if (
                playerToNumberPicked[_player] < result &&
                result - playerToNumberPicked[_player] < _winnerNumber
            ) {
                _winnerNumber = result - playerToNumberPicked[_player];
                _winner = _player;
            }
        }
        emit Winner(_winner, playerToNumberPicked[_winner]);
    }

    // view/pure functions

    function getDealine() external view returns (uint256) {
        return gameDeadline;
    }

    function revealDeadline() external view returns (uint256) {
        return revealNumberDeadline;
    }

    function getEntryFee() external view returns (uint256) {
        return entryFee;
    }

    function getPlayersCount() external view returns (uint256) {
        return players.length;
    }

    function getPlayerRevealedNumber(address _player)
        external
        view
        returns (uint256)
    {
        return playerToNumberPicked[_player];
    }

    function getRevealedPlayersCount() external view returns (uint256) {
        return playersRevealed.length;
    }

    //    helper function to create secret
    function createSecret(uint8 _number, bytes32 _salt)
        external
        pure
        returns (bytes32)
    {
        bytes32 hash = keccak256(abi.encodePacked(_number, _salt));
        return hash;
    }
}
