// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./CustomToken.sol";

struct Proposal {
    uint256 id;
    uint256 goal; // total price of proposal
    uint256 pledged; // total tokens pledged
    uint256 numAccounts; // total number of accounts
    address recipient; // address of receiever of tokens
    bool active; // current status of proposal
    mapping(uint256 => address) accounts; // maps index to addresses of accounts
    mapping(address => uint256) ledger; // maps address of an account to number of tokens pledged
    // mapping(uint256 => mapping(address => uint256)) indexedAccountLedger; // possible implementation
}

contract CustomTokenV2 is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    CustomToken
{
    event ProposalCreated(uint256 _id, uint _goal, address _recipient);
    event ProposalCancelled(uint _id);
    event ProposalDisbursed(uint _id, uint _amount, address _recipient);
    event TokensClaimed(address _to);
    event TokensPledged(address _from, uint _proposalId);

    mapping(uint256 => Proposal) public proposals;
    uint256 public numProposals;

    modifier onlyActiveProposal(uint256 id) {
        require(proposals[id].active == true, "Invalid Proposal.");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initializeV2() public initializer {
        super.initialize();
    }

    /**
     * Basic ICO of 100 tokens
     */
    function claim() public {
        mint(msg.sender, 100);
        emit TokensClaimed(msg.sender);
    }

    /**
     * Creates Proposal for sending tokens `to` address
     */
    function createProposal(
        uint256 _goal,
        address to
    ) public returns (uint256) {
        require(_goal > 0, "Invalid Goal.");

        Proposal storage proposal = proposals[numProposals];
        proposal.id = numProposals;
        proposal.goal = _goal;
        numProposals += 1;
        proposal.recipient = to;
        proposal.active = true;

        emit ProposalCreated(numProposals - 1, _goal, to);

        return numProposals - 1;
    }

    function endProposal(uint256 id) public onlyActiveProposal(id) {
        Proposal storage proposal = proposals[id];

        proposal.active = false;

        // if total pledged tokens exceeds goal, disburse tokens to recipient
        if (proposal.pledged >= proposal.goal) {
            // transferFrom();
            mint(proposal.recipient, proposal.pledged);
            emit ProposalDisbursed(id, proposal.pledged, proposal.recipient);
        } else {
            // else, refund tokens to all addresses
            for (uint256 i = 0; i < proposal.numAccounts; i++) {
                mint(
                    proposal.accounts[i],
                    proposal.ledger[proposal.accounts[i]]
                );
                // transferFrom();
                emit ProposalCancelled(id);
            }
        }
    }

    function pledge(uint256 id, uint256 amount) public onlyActiveProposal(id) {
        require(amount > 0, "Invalid Amount.");
        require(balanceOf(msg.sender) >= amount, "Insufficient Tokens.");

        Proposal storage proposal = proposals[id];

        // check if msg.sender is a new address in ledger
        // if it is new, add index to address
        if (proposal.ledger[msg.sender] == 0) {
            proposal.accounts[proposal.numAccounts] = msg.sender;
            proposal.numAccounts += 1;
        }

        // update token amounts in proposal
        proposals[id].ledger[msg.sender] += amount;
        proposals[id].pledged += amount;

        // send tokens from account to contract to hold
        // transfer(address(this), amount);
        burn(amount);

        emit TokensPledged(msg.sender, amount);
    }

    function getPledge(
        uint256 id,
        address account
    ) public view returns (uint256) {
        return proposals[id].ledger[account];
    }

    receive() external payable {}

    fallback() external payable {}
}
