// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./CustomToken.sol";

struct Proposal {
    uint id;
    uint goal; // total price of proposal
    uint pledged; // total tokens pledged
    uint numAccounts; // total number of accounts
    bool active; // current status of proposal
    address recipient; // address of receiever of tokens
    mapping(uint => address) accounts; // maps index to addresses of accounts
    mapping(address => uint) ledger; // maps address of an account to number of tokens pledged
}

contract CustomTokenV2 is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    CustomToken
{
    CustomToken public customTokenAddress;

    mapping(uint => Proposal) public proposals;
    uint public numProposals;

    modifier onlyActiveProposal(uint id) {
        require(proposals[id].active == true);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _CustomToken) public initializer {
        __ERC20_init("CustomToken", "CTK");
        __ERC20Burnable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        require(_CustomToken != address(0), "Invalid Token Address.");
        customTokenAddress = CustomToken(_CustomToken);
    }

    /**
     * Basic ICO of 100 tokens
     */
    function claim() public {
        mint(msg.sender, 100);
    }

    /**
     * Creates Proposal to send tokens `to` address
     */
    function createProposal(uint _goal, address to) public returns (uint) {
        Proposal storage proposal = proposals[numProposals];
        proposal.id = numProposals;
        proposal.goal = _goal;
        numProposals += 1;
        proposal.recipient = to;
        proposal.active = true;

        return numProposals - 1;
    }

    function endProposal(uint id) public onlyActiveProposal(id) {
        Proposal storage proposal = proposals[id];

        proposal.active = false;

        // if total pledged tokens exceeds goal, disburse tokens to recipient
        if (proposal.pledged >= proposal.goal) {
            customTokenAddress.transferFrom(
                address(this),
                proposal.recipient,
                proposal.pledged
            );
        } else {
            // else, refund tokens to all addresses
            for (uint i = 0; i < proposal.numAccounts; i++) {
                customTokenAddress.transferFrom(
                    address(this),
                    proposal.accounts[i],
                    proposal.ledger[proposal.accounts[i]]
                );
            }
        }
    }

    function pledge(uint id, uint amount) public {
        require(
            customTokenAddress.balanceOf(msg.sender) >= amount,
            "Insufficient Tokens."
        );

        Proposal storage proposal = proposals[id];

        // check if msg.sender is a new address in ledger
        // if it is new, add index to address
        if (proposal.ledger[msg.sender] == 0) {
            proposal.accounts[proposal.numAccounts] = msg.sender;
            proposal.numAccounts += 1;
        }

        // update token amounts in proposal
        proposal.ledger[msg.sender] += amount;
        proposal.pledged += amount;

        customTokenAddress.transferFrom(msg.sender, address(this), amount);
    }

    receive() external payable {}

    fallback() external payable {}
}
