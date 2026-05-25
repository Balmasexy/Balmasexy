const { expect } = require("chai");
const hre = require("hardhat");

describe("BALMZToken", function () {
  let balmzToken;
  let owner, addr1, addr2, addr3, treasuryWallet, marketingWallet;
  const INITIAL_SUPPLY = hre.ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, treasuryWallet, marketingWallet] = await hre.ethers.getSigners();

    const BALMZToken = await hre.ethers.getContractFactory("BALMZToken");
    balmzToken = await BALMZToken.deploy(treasuryWallet.address, marketingWallet.address);
    await balmzToken.waitForDeployment();
  });

  // ========================================
  // DEPLOYMENT TESTS
  // ========================================

  describe("Deployment", function () {
    it("Should have correct name", async function () {
      expect(await balmzToken.name()).to.equal("BALMZ Token");
    });

    it("Should have correct symbol", async function () {
      expect(await balmzToken.symbol()).to.equal("BALMZ");
    });

    it("Should have 18 decimals", async function () {
      expect(await balmzToken.decimals()).to.equal(18);
    });

    it("Should mint initial supply to owner", async function () {
      const ownerBalance = await balmzToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(INITIAL_SUPPLY);
    });

    it("Should have correct total supply", async function () {
      expect(await balmzToken.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("Should set correct owner", async function () {
      expect(await balmzToken.owner()).to.equal(owner.address);
    });

    it("Should set correct treasury wallet", async function () {
      expect(await balmzToken.treasuryWallet()).to.equal(treasuryWallet.address);
    });

    it("Should set correct marketing wallet", async function () {
      expect(await balmzToken.marketingWallet()).to.equal(marketingWallet.address);
    });

    it("Should whitelist owner, treasury, and marketing wallets", async function () {
      expect(await balmzToken.isWhitelisted(owner.address)).to.be.true;
      expect(await balmzToken.isWhitelisted(treasuryWallet.address)).to.be.true;
      expect(await balmzToken.isWhitelisted(marketingWallet.address)).to.be.true;
    });
  });

  // ========================================
  // TRANSFER TESTS
  // ========================================

  describe("Transfers", function () {
    it("Should transfer tokens from owner to addr1", async function () {
      const transferAmount = hre.ethers.parseEther("100");
      await balmzToken.transfer(addr1.address, transferAmount);
      expect(await balmzToken.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("Should fail if sender does not have enough tokens", async function () {
      const transferAmount = hre.ethers.parseEther("1000000000");
      await expect(
        balmzToken.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(balmzToken, "ERC20InsufficientBalance");
    });

    it("Should transfer tokens between non-whitelisted addresses if within limit", async function () {
      const transferAmount = hre.ethers.parseEther("5000");
      await balmzToken.transfer(addr1.address, hre.ethers.parseEther("10000"));
      await balmzToken.connect(addr1).transfer(addr2.address, transferAmount);
      expect(await balmzToken.balanceOf(addr2.address)).to.equal(transferAmount);
    });

    it("Should fail if transfer exceeds max transaction amount", async function () {
      const maxAmount = await balmzToken.maxTransactionAmount();
      const excessAmount = maxAmount + hre.ethers.parseEther("1");
      await balmzToken.transfer(addr1.address, excessAmount);
      
      await expect(
        balmzToken.connect(addr1).transfer(addr2.address, excessAmount)
      ).to.be.revertedWith("BALMZ: Transfer amount exceeds maximum");
    });

    it("Should allow whitelisted address to transfer above limit", async function () {
      const maxAmount = await balmzToken.maxTransactionAmount();
      const excessAmount = maxAmount + hre.ethers.parseEther("1");
      
      await balmzToken.whitelistAddress(addr1.address);
      await balmzToken.transfer(addr1.address, excessAmount);
      
      await expect(
        balmzToken.connect(addr1).transfer(addr2.address, excessAmount)
      ).to.not.be.reverted;
    });

    it("Should emit Transfer event", async function () {
      const transferAmount = hre.ethers.parseEther("100");
      await expect(
        balmzToken.transfer(addr1.address, transferAmount)
      ).to.emit(balmzToken, "Transfer");
    });
  });

  // ========================================
  // MINTING TESTS
  // ========================================

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = hre.ethers.parseEther("1000");
      await balmzToken.mint(addr1.address, mintAmount);
      expect(await balmzToken.balanceOf(addr1.address)).to.equal(mintAmount);
    });

    it("Should fail if non-owner tries to mint", async function () {
      const mintAmount = hre.ethers.parseEther("1000");
      await expect(
        balmzToken.connect(addr1).mint(addr2.address, mintAmount)
      ).to.be.revertedWithCustomError(balmzToken, "OwnableUnauthorizedAccount");
    });

    it("Should fail if minting to zero address", async function () {
      const mintAmount = hre.ethers.parseEther("1000");
      await expect(
        balmzToken.mint(hre.ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWith("BALMZ: Cannot mint to zero address");
    });

    it("Should fail if mint amount is zero", async function () {
      await expect(
        balmzToken.mint(addr1.address, 0)
      ).to.be.revertedWith("BALMZ: Mint amount must be greater than zero");
    });

    it("Should support batch minting", async function () {
      const addresses = [addr1.address, addr2.address, addr3.address];
      const amounts = [
        hre.ethers.parseEther("1000"),
        hre.ethers.parseEther("2000"),
        hre.ethers.parseEther("3000")
      ];
      
      await balmzToken.batchMint(addresses, amounts);
      
      expect(await balmzToken.balanceOf(addr1.address)).to.equal(amounts[0]);
      expect(await balmzToken.balanceOf(addr2.address)).to.equal(amounts[1]);
      expect(await balmzToken.balanceOf(addr3.address)).to.equal(amounts[2]);
    });

    it("Should increase total supply when minting", async function () {
      const initialSupply = await balmzToken.totalSupply();
      const mintAmount = hre.ethers.parseEther("1000");
      await balmzToken.mint(addr1.address, mintAmount);
      expect(await balmzToken.totalSupply()).to.equal(initialSupply + mintAmount);
    });
  });

  // ========================================
  // BURNING TESTS
  // ========================================

  describe("Burning", function () {
    it("Should allow token holder to burn tokens", async function () {
      const burnAmount = hre.ethers.parseEther("100");
      await balmzToken.transfer(addr1.address, hre.ethers.parseEther("1000"));
      await balmzToken.connect(addr1).burn(burnAmount);
      expect(await balmzToken.balanceOf(addr1.address)).to.equal(hre.ethers.parseEther("900"));
    });

    it("Should decrease total supply when burning", async function () {
      const initialSupply = await balmzToken.totalSupply();
      const burnAmount = hre.ethers.parseEther("100");
      await balmzToken.burn(burnAmount);
      expect(await balmzToken.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should emit Burn event", async function () {
      const burnAmount = hre.ethers.parseEther("100");
      await expect(
        balmzToken.burn(burnAmount)
      ).to.emit(balmzToken, "Transfer").withArgs(owner.address, hre.ethers.ZeroAddress, burnAmount);
    });
  });

  // ========================================
  // PAUSE/UNPAUSE TESTS
  // ========================================

  describe("Pause/Unpause", function () {
    it("Should allow owner to pause transfers", async function () {
      await balmzToken.pause();
      expect(await balmzToken.paused()).to.be.true;
    });

    it("Should prevent transfers when paused", async function () {
      await balmzToken.pause();
      await expect(
        balmzToken.transfer(addr1.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWith("BALMZ: Token transfers are paused");
    });

    it("Should allow owner to unpause transfers", async function () {
      await balmzToken.pause();
      await balmzToken.unpause();
      expect(await balmzToken.paused()).to.be.false;
    });

    it("Should fail if non-owner tries to pause", async function () {
      await expect(
        balmzToken.connect(addr1).pause()
      ).to.be.revertedWithCustomError(balmzToken, "OwnableUnauthorizedAccount");
    });
  });

  // ========================================
  // BLACKLIST TESTS
  // ========================================

  describe("Blacklist", function () {
    it("Should blacklist an address", async function () {
      await balmzToken.blacklistAddress(addr1.address);
      expect(await balmzToken.isBlacklisted(addr1.address)).to.be.true;
    });

    it("Should prevent blacklisted address from transferring", async function () {
      await balmzToken.transfer(addr1.address, hre.ethers.parseEther("1000"));
      await balmzToken.blacklistAddress(addr1.address);
      
      await expect(
        balmzToken.connect(addr1).transfer(addr2.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWith("BALMZ: Account is blacklisted");
    });

    it("Should prevent transfers to blacklisted address", async function () {
      await balmzToken.blacklistAddress(addr2.address);
      
      await expect(
        balmzToken.transfer(addr2.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWith("BALMZ: Account is blacklisted");
    });

    it("Should remove address from blacklist", async function () {
      await balmzToken.blacklistAddress(addr1.address);
      await balmzToken.removeFromBlacklist(addr1.address);
      expect(await balmzToken.isBlacklisted(addr1.address)).to.be.false;
    });

    it("Should support batch blacklisting", async function () {
      const addresses = [addr1.address, addr2.address, addr3.address];
      await balmzToken.batchBlacklist(addresses);
      
      expect(await balmzToken.isBlacklisted(addr1.address)).to.be.true;
      expect(await balmzToken.isBlacklisted(addr2.address)).to.be.true;
      expect(await balmzToken.isBlacklisted(addr3.address)).to.be.true;
    });

    it("Should emit AddressBlacklisted event", async function () {
      await expect(
        balmzToken.blacklistAddress(addr1.address)
      ).to.emit(balmzToken, "AddressBlacklisted").withArgs(addr1.address, true);
    });

    it("Should fail to blacklist zero address", async function () {
      await expect(
        balmzToken.blacklistAddress(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("BALMZ: Cannot blacklist zero address");
    });

    it("Should fail to blacklist owner", async function () {
      await expect(
        balmzToken.blacklistAddress(owner.address)
      ).to.be.revertedWith("BALMZ: Cannot blacklist owner");
    });
  });

  // ========================================
  // WHITELIST TESTS
  // ========================================

  describe("Whitelist", function () {
    it("Should whitelist an address", async function () {
      await balmzToken.whitelistAddress(addr1.address);
      expect(await balmzToken.isWhitelisted(addr1.address)).to.be.true;
    });

    it("Should remove address from whitelist", async function () {
      await balmzToken.whitelistAddress(addr1.address);
      await balmzToken.removeFromWhitelist(addr1.address);
      expect(await balmzToken.isWhitelisted(addr1.address)).to.be.false;
    });

    it("Should emit AddressWhitelisted event", async function () {
      await expect(
        balmzToken.whitelistAddress(addr1.address)
      ).to.emit(balmzToken, "AddressWhitelisted").withArgs(addr1.address, true);
    });

    it("Should fail if non-owner tries to whitelist", async function () {
      await expect(
        balmzToken.connect(addr1).whitelistAddress(addr2.address)
      ).to.be.revertedWithCustomError(balmzToken, "OwnableUnauthorizedAccount");
    });
  });

  // ========================================
  // TRANSACTION LIMIT TESTS
  // ========================================

  describe("Transaction Limits", function () {
    it("Should have default max transaction amount", async function () {
      const maxAmount = await balmzToken.maxTransactionAmount();
      expect(maxAmount).to.equal(INITIAL_SUPPLY / BigInt(100)); // 1% of supply
    });

    it("Should allow owner to update max transaction amount", async function () {
      const newAmount = hre.ethers.parseEther("50000");
      await balmzToken.setMaxTransactionAmount(newAmount);
      expect(await balmzToken.maxTransactionAmount()).to.equal(newAmount);
    });

    it("Should emit MaxTransactionAmountUpdated event", async function () {
      const newAmount = hre.ethers.parseEther("50000");
      await expect(
        balmzToken.setMaxTransactionAmount(newAmount)
      ).to.emit(balmzToken, "MaxTransactionAmountUpdated").withArgs(newAmount);
    });

    it("Should fail if max amount is zero", async function () {
      await expect(
        balmzToken.setMaxTransactionAmount(0)
      ).to.be.revertedWith("BALMZ: Max transaction amount must be greater than zero");
    });

    it("Should fail if max amount is too low", async function () {
      const tooLowAmount = hre.ethers.parseEther("100");
      await expect(
        balmzToken.setMaxTransactionAmount(tooLowAmount)
      ).to.be.revertedWith("BALMZ: Max transaction amount too low");
    });
  });

  // ========================================
  // FEE TESTS
  // ========================================

  describe("Fees", function () {
    it("Should set transaction fee", async function () {
      await balmzToken.setTransactionFee(50); // 0.5%
      expect(await balmzToken.transactionFeePercentage()).to.equal(50);
    });

    it("Should emit TransactionFeeUpdated event", async function () {
      await expect(
        balmzToken.setTransactionFee(50)
      ).to.emit(balmzToken, "TransactionFeeUpdated").withArgs(50);
    });

    it("Should fail if fee exceeds 100", async function () {
      await expect(
        balmzToken.setTransactionFee(101)
      ).to.be.revertedWith("BALMZ: Fee percentage cannot exceed 100");
    });

    it("Should collect fees on transfers", async function () {
      await balmzToken.setTransactionFee(100); // 1%
      await balmzToken.transfer(addr1.address, hre.ethers.parseEther("10000"));
      
      const transferAmount = hre.ethers.parseEther("1000");
      await balmzToken.connect(addr1).transfer(addr2.address, transferAmount);
      
      const accumulatedFees = await balmzToken.accumulatedFees();
      expect(accumulatedFees).to.be.greaterThan(0);
    });

    it("Should withdraw fees", async function () {
      await balmzToken.setTransactionFee(100);
      await balmzToken.transfer(addr1.address, hre.ethers.parseEther("10000"));
      await balmzToken.connect(addr1).transfer(addr2.address, hre.ethers.parseEther("1000"));
      
      const accumulatedFees = await balmzToken.accumulatedFees();
      const initialBalance = await balmzToken.balanceOf(owner.address);
      
      await balmzToken.withdrawFees();
      
      const finalBalance = await balmzToken.balanceOf(owner.address);
      expect(finalBalance).to.equal(initialBalance + accumulatedFees);
      expect(await balmzToken.accumulatedFees()).to.equal(0);
    });

    it("Should distribute fees to treasury and marketing", async function () {
      await balmzToken.setTransactionFee(100);
      await balmzToken.transfer(addr1.address, hre.ethers.parseEther("10000"));
      await balmzToken.connect(addr1).transfer(addr2.address, hre.ethers.parseEther("1000"));
      
      const accumulatedFees = await balmzToken.accumulatedFees();
      const treasuryInitialBalance = await balmzToken.balanceOf(treasuryWallet.address);
      
      await balmzToken.distributeFees();
      
      const treasuryFinalBalance = await balmzToken.balanceOf(treasuryWallet.address);
      expect(treasuryFinalBalance).to.be.greaterThan(treasuryInitialBalance);
      expect(await balmzToken.accumulatedFees()).to.equal(0);
    });
  });

  // ========================================
  // WALLET UPDATE TESTS
  // ========================================

  describe("Wallet Updates", function () {
    it("Should update treasury wallet", async function () {
      await balmzToken.setTreasuryWallet(addr1.address);
      expect(await balmzToken.treasuryWallet()).to.equal(addr1.address);
    });

    it("Should whitelist new treasury wallet", async function () {
      await balmzToken.setTreasuryWallet(addr1.address);
      expect(await balmzToken.isWhitelisted(addr1.address)).to.be.true;
    });

    it("Should update marketing wallet", async function () {
      await balmzToken.setMarketingWallet(addr2.address);
      expect(await balmzToken.marketingWallet()).to.equal(addr2.address);
    });

    it("Should emit TreasuryWalletUpdated event", async function () {
      await expect(
        balmzToken.setTreasuryWallet(addr1.address)
      ).to.emit(balmzToken, "TreasuryWalletUpdated").withArgs(addr1.address);
    });

    it("Should fail if treasury wallet is zero address", async function () {
      await expect(
        balmzToken.setTreasuryWallet(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("BALMZ: Invalid treasury wallet");
    });

    it("Should fail if marketing wallet is zero address", async function () {
      await expect(
        balmzToken.setMarketingWallet(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("BALMZ: Invalid marketing wallet");
    });
  });

  // ========================================
  // VOTING TESTS (ERC20Votes)
  // ========================================

  describe("Voting (ERC20Votes)", function () {
    it("Should allow delegating votes", async function () {
      await balmzToken.transfer(addr1.address, hre.ethers.parseEther("1000"));
      await balmzToken.connect(addr1).delegate(addr1.address);
      
      const votes = await balmzToken.getVotes(addr1.address);
      expect(votes).to.equal(hre.ethers.parseEther("1000"));
    });

    it("Should track voting power", async function () {
      await balmzToken.delegate(owner.address);
      const votes = await balmzToken.getVotes(owner.address);
      expect(votes).to.equal(INITIAL_SUPPLY);
    });
  });

  // ========================================
  // PERMIT TESTS (ERC20Permit)
  // ========================================

  describe("Permit (ERC20Permit)", function () {
    it("Should return nonce for address", async function () {
      const nonce = await balmzToken.nonces(owner.address);
      expect(nonce).to.equal(0);
    });

    it("Should allow permit operations", async function () {
      const value = hre.ethers.parseEther("1000");
      const nonce = await balmzToken.nonces(owner.address);
      const deadline = (await hre.ethers.provider.getBlock("latest")).timestamp + 3600;

      const domain = {
        name: "BALMZ Token",
        version: "1",
        chainId: (await hre.ethers.provider.getNetwork()).chainId,
        verifyingContract: await balmzToken.getAddress()
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };

      const message = {
        owner: owner.address,
        spender: addr1.address,
        value: value,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await owner.signTypedData(domain, types, message);
      const { v, r, s } = hre.ethers.Signature.from(signature);

      await balmzToken.permit(
        owner.address,
        addr1.address,
        value,
        deadline,
        v,
        r,
        s
      );

      expect(await balmzToken.allowance(owner.address, addr1.address)).to.equal(value);
    });
  });

  // ========================================
  // APPROVAL TESTS
  // ========================================

  describe("Approvals", function () {
    it("Should approve tokens for spending", async function () {
      const approveAmount = hre.ethers.parseEther("1000");
      await balmzToken.approve(addr1.address, approveAmount);
      expect(await balmzToken.allowance(owner.address, addr1.address)).to.equal(approveAmount);
    });

    it("Should transfer approved tokens", async function () {
      const approveAmount = hre.ethers.parseEther("1000");
      await balmzToken.approve(addr1.address, approveAmount);
      
      await balmzToken.connect(addr1).transferFrom(owner.address, addr2.address, approveAmount);
      expect(await balmzToken.balanceOf(addr2.address)).to.equal(approveAmount);
    });

    it("Should increase allowance", async function () {
      const initialAmount = hre.ethers.parseEther("1000");
      const increaseAmount = hre.ethers.parseEther("500");
      
      await balmzToken.approve(addr1.address, initialAmount);
      await balmzToken.increaseAllowance(addr1.address, increaseAmount);
      
      expect(await balmzToken.allowance(owner.address, addr1.address)).to.equal(initialAmount + increaseAmount);
    });

    it("Should decrease allowance", async function () {
      const initialAmount = hre.ethers.parseEther("1000");
      const decreaseAmount = hre.ethers.parseEther("500");
      
      await balmzToken.approve(addr1.address, initialAmount);
      await balmzToken.decreaseAllowance(addr1.address, decreaseAmount);
      
      expect(await balmzToken.allowance(owner.address, addr1.address)).to.equal(initialAmount - decreaseAmount);
    });

    it("Should emit Approval event", async function () {
      const approveAmount = hre.ethers.parseEther("1000");
      await expect(
        balmzToken.approve(addr1.address, approveAmount)
      ).to.emit(balmzToken, "Approval");
    });
  });
});
