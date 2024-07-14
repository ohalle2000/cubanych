// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DiceGame {
    address public owner;

    event GamePlayed(address indexed player, bool won, uint256 amountWon, uint256 roll);
    event Withdrawal(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function playGame() public payable {
        require(msg.value > 0, "Must send ETH to play");

        uint256 roll = _random() % 6 + 1; // Simple pseudo-randomness

        uint256 amountWon = 0;
        if (roll == 1) {
            amountWon = 0;
        } else if (roll == 2) {
            amountWon = msg.value * 49 / 100;
        } else if (roll == 3) {
            amountWon = msg.value * 79 / 100;
        } else if (roll == 4) {
            amountWon = msg.value * 119 / 100;
        } else if (roll == 5) {
            amountWon = msg.value * 149 / 100;
        } else if (roll == 6) {
            amountWon = msg.value * 199 / 100;
        }
 
        require(address(this).balance >= amountWon, "Contract balance too low");
        (bool success, ) = msg.sender.call{value: amountWon}("");
        require(success, "Transfer failed");
        emit GamePlayed(msg.sender, true, amountWon, roll);
    }

    function _random() private view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender)));
    }

    // Owner can withdraw ETH from the contract
    function withdraw() public onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Withdrawal failed");
        emit Withdrawal(owner, amount);
    }


    // Fallback function to receive ETH
    receive() external payable {}
}