// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/Nonces.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BALMZToken
 * @dev BALMZ Token - World Invisible Individual Explorer
 * 
 * An advanced ERC-20 token representing the identity of a public token explorer
 * on the blockchain ecosystem. Features include burning, pausing, minting, and
 * governance capabilities through voting.
 * 
 * @author Balmasexy (Alabama Abiodun)
 * @notice This token serves as both a utility and governance token for the ecosystem
 */
contract BALMZToken is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    ERC20Permit,
    ERC20Votes,
    Ownable
{
    // ============================================
    // CONSTANTS
    // ============================================
    
    /// @notice Total initial supply: 1 million BALMZ tokens
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;
    
    /// @notice Token decimals
    uint256 public constant TOKEN_DECIMALS = 18;
    
    /// @notice Fee calculation divisor (basis points: 10000 = 100%)
    uint256 public constant FEE_DIVISOR = 10000;
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice Maximum transaction amount (anti-whale mechanism)
    uint256 public maxTransactionAmount = INITIAL_SUPPLY / 100;
    
    /// @notice Mapping of blacklisted addresses
    mapping(address => bool) public blacklisted;
    
    /// @notice Mapping of whitelisted addresses (exempt from limits)
    mapping(address => bool) public whitelisted;
    
    /// @notice Treasury wallet address
    address public treasuryWallet;
    
    /// @notice Marketing wallet address
    address public marketingWallet;
    
    /// @notice Transaction fee percentage (0-100)
    uint256 public transactionFeePercentage = 0;
    
    /// @notice Accumulated fees in the contract
    uint256 public accumulatedFees = 0;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event AddressBlacklisted(address indexed account, bool isBlacklisted);
    event AddressWhitelisted(address indexed account, bool isWhitelisted);
    event MaxTransactionAmountUpdated(uint256 newAmount);
    event TreasuryWalletUpdated(address indexed newTreasury);
    event MarketingWalletUpdated(address indexed newMarketing);
    event TransactionFeeUpdated(uint256 newFeePercentage);
    event FeesCollected(uint256 amount);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event FeesDistributed(uint256 treasuryAmount, uint256 marketingAmount);
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier notBlacklisted(address account) {
        require(!blacklisted[account], "BALMZ: Account is blacklisted");
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(address _treasuryWallet, address _marketingWallet)
        ERC20("BALMZ Token", "BALMZ")
        ERC20Permit("BALMZ Token")
        Ownable(msg.sender)
    {
        require(_treasuryWallet != address(0), "BALMZ: Invalid treasury wallet");
        require(_marketingWallet != address(0), "BALMZ: Invalid marketing wallet");
        
        treasuryWallet = _treasuryWallet;
        marketingWallet = _marketingWallet;
        
        whitelisted[msg.sender] = true;
        whitelisted[_treasuryWallet] = true;
        whitelisted[_marketingWallet] = true;
        
        _mint(msg.sender, INITIAL_SUPPLY);
    }
    
    // ============================================
    // PAUSE/UNPAUSE FUNCTIONS
    // ============================================
    
    function pause() public onlyOwner {
        _pause();
    }
    
    function unpause() public onlyOwner {
        _unpause();
    }
    
    // ============================================
    // MINTING FUNCTIONS
    // ============================================
    
    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "BALMZ: Cannot mint to zero address");
        require(amount > 0, "BALMZ: Mint amount must be greater than zero");
        _mint(to, amount);
    }
    
    function batchMint(address[] calldata addresses, uint256[] calldata amounts) 
        public 
        onlyOwner 
    {
        require(addresses.length == amounts.length, "BALMZ: Arrays length mismatch");
        require(addresses.length > 0, "BALMZ: Empty arrays");
        
        for (uint256 i = 0; i < addresses.length; i++) {
            require(addresses[i] != address(0), "BALMZ: Cannot mint to zero address");
            require(amounts[i] > 0, "BALMZ: Mint amount must be greater than zero");
            _mint(addresses[i], amounts[i]);
        }
    }
    
    // ============================================
    // BLACKLIST FUNCTIONS
    // ============================================
    
    function blacklistAddress(address account) public onlyOwner {
        require(account != address(0), "BALMZ: Cannot blacklist zero address");
        require(account != owner(), "BALMZ: Cannot blacklist owner");
        blacklisted[account] = true;
        emit AddressBlacklisted(account, true);
    }
    
    function removeFromBlacklist(address account) public onlyOwner {
        require(blacklisted[account], "BALMZ: Address is not blacklisted");
        blacklisted[account] = false;
        emit AddressBlacklisted(account, false);
    }
    
    function batchBlacklist(address[] calldata accounts) public onlyOwner {
        require(accounts.length > 0, "BALMZ: Empty array");
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "BALMZ: Cannot blacklist zero address");
            require(accounts[i] != owner(), "BALMZ: Cannot blacklist owner");
            blacklisted[accounts[i]] = true;
            emit AddressBlacklisted(accounts[i], true);
        }
    }
    
    // ============================================
    // WHITELIST FUNCTIONS
    // ============================================
    
    function whitelistAddress(address account) public onlyOwner {
        require(account != address(0), "BALMZ: Cannot whitelist zero address");
        whitelisted[account] = true;
        emit AddressWhitelisted(account, true);
    }
    
    function removeFromWhitelist(address account) public onlyOwner {
        whitelisted[account] = false;
        emit AddressWhitelisted(account, false);
    }
    
    // ============================================
    // TRANSACTION LIMIT FUNCTIONS
    // ============================================
    
    function setMaxTransactionAmount(uint256 newAmount) public onlyOwner {
        require(newAmount > 0, "BALMZ: Max transaction amount must be greater than zero");
        require(newAmount >= INITIAL_SUPPLY / 1000, "BALMZ: Max transaction amount too low");
        maxTransactionAmount = newAmount;
        emit MaxTransactionAmountUpdated(newAmount);
    }
    
    // ============================================
    // FEE FUNCTIONS
    // ============================================
    
    function setTransactionFee(uint256 feePercentage) public onlyOwner {
        require(feePercentage <= 100, "BALMZ: Fee percentage cannot exceed 100");
        transactionFeePercentage = feePercentage;
        emit TransactionFeeUpdated(feePercentage);
    }
    
    function withdrawFees() public onlyOwner {
        require(accumulatedFees > 0, "BALMZ: No fees to withdraw");
        uint256 feesToWithdraw = accumulatedFees;
        accumulatedFees = 0;
        _transfer(address(this), owner(), feesToWithdraw);
        emit FeesWithdrawn(owner(), feesToWithdraw);
    }
    
    function distributeFees() public onlyOwner {
        require(accumulatedFees > 0, "BALMZ: No fees to distribute");
        
        uint256 feesToDistribute = accumulatedFees;
        accumulatedFees = 0;
        
        uint256 treasuryAmount = feesToDistribute / 2;
        uint256 marketingAmount = feesToDistribute - treasuryAmount;
        
        _transfer(address(this), treasuryWallet, treasuryAmount);
        _transfer(address(this), marketingWallet, marketingAmount);
        
        emit FeesDistributed(treasuryAmount, marketingAmount);
    }
    
    // ============================================
    // WALLET UPDATE FUNCTIONS
    // ============================================
    
    function setTreasuryWallet(address newTreasury) public onlyOwner {
        require(newTreasury != address(0), "BALMZ: Invalid treasury wallet");
        treasuryWallet = newTreasury;
        whitelisted[newTreasury] = true;
        emit TreasuryWalletUpdated(newTreasury);
    }
    
    function setMarketingWallet(address newMarketing) public onlyOwner {
        require(newMarketing != address(0), "BALMZ: Invalid marketing wallet");
        marketingWallet = newMarketing;
        whitelisted[newMarketing] = true;
        emit MarketingWalletUpdated(newMarketing);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    function decimals() public pure override returns (uint8) {
        return 18;
    }
    
    function isBlacklisted(address account) public view returns (bool) {
        return blacklisted[account];
    }
    
    function isWhitelisted(address account) public view returns (bool) {
        return whitelisted[account];
    }
    
    // ============================================
    // INTERNAL OVERRIDE FUNCTIONS
    // ============================================
    
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable, ERC20Votes) notBlacklisted(from) notBlacklisted(to) {
        require(!paused(), "BALMZ: Token transfers are paused");
        
        if (!whitelisted[from] && !whitelisted[to] && from != address(0)) {
            require(amount <= maxTransactionAmount, "BALMZ: Transfer amount exceeds maximum");
        }
        
        uint256 feeAmount = 0;
        if (transactionFeePercentage > 0 && from != address(0) && to != address(0)) {
            if (!whitelisted[from] && !whitelisted[to]) {
                feeAmount = (amount * transactionFeePercentage * 100) / FEE_DIVISOR;
                accumulatedFees += feeAmount;
                emit FeesCollected(feeAmount);
            }
        }
        
        uint256 transferAmount = amount - feeAmount;
        super._update(from, to, transferAmount);
        
        if (feeAmount > 0) {
            super._update(from, address(this), feeAmount);
        }
    }
    
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
