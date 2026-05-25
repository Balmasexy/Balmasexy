const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting BALMZ Token deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contract with account:", deployer.address);
  console.log("💰 Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Define wallet addresses
  // Update these with your actual wallet addresses
  const TREASURY_WALLET = process.env.TREASURY_WALLET || deployer.address;
  const MARKETING_WALLET = process.env.MARKETING_WALLET || deployer.address;

  console.log("\n📋 Deployment Configuration:");
  console.log("   Token Name: BALMZ Token");
  console.log("   Symbol: BALMZ");
  console.log("   Initial Supply: 1,000,000 tokens");
  console.log("   Decimals: 18");
  console.log("   Treasury Wallet:", TREASURY_WALLET);
  console.log("   Marketing Wallet:", MARKETING_WALLET);

  try {
    // Deploy the contract
    console.log("\n⏳ Deploying BALMZToken contract...");
    const BALMZToken = await hre.ethers.getContractFactory("BALMZToken");
    const balmzToken = await BALMZToken.deploy(TREASURY_WALLET, MARKETING_WALLET);

    await balmzToken.waitForDeployment();
    const contractAddress = await balmzToken.getAddress();

    console.log("✅ BALMZToken deployed successfully!");
    console.log("📄 Contract Address:", contractAddress);
    console.log("🔗 Etherscan URL: https://etherscan.io/address/" + contractAddress);

    // Get deployment details
    const totalSupply = await balmzToken.totalSupply();
    const decimals = await balmzToken.decimals();
    const name = await balmzToken.name();
    const symbol = await balmzToken.symbol();

    console.log("\n📊 Token Details:");
    console.log("   Name:", name);
    console.log("   Symbol:", symbol);
    console.log("   Total Supply:", (totalSupply / BigInt(10 ** 18)).toString(), symbol);
    console.log("   Decimals:", decimals.toString());

    // Check initial balances
    const deployerBalance = await balmzToken.balanceOf(deployer.address);
    console.log("\n💵 Initial Balance (Deployer):", (deployerBalance / BigInt(10 ** 18)).toString(), symbol);

    // Verify contract on Etherscan (optional)
    if (process.env.ETHERSCAN_API_KEY && hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
      console.log("\n⏳ Waiting for block confirmations before Etherscan verification...");
      await balmzToken.deploymentTransaction().wait(5);

      console.log("🔍 Verifying contract on Etherscan...");
      try {
        await hre.run("verify:verify", {
          address: contractAddress,
          constructorArguments: [TREASURY_WALLET, MARKETING_WALLET],
        });
        console.log("✅ Contract verified on Etherscan!");
      } catch (error) {
        console.log("⚠️ Etherscan verification failed (this is optional):", error.message);
      }
    }

    // Save deployment info to file
    const fs = require("fs");
    const deploymentInfo = {
      network: hre.network.name,
      contractAddress: contractAddress,
      deployer: deployer.address,
      treasuryWallet: TREASURY_WALLET,
      marketingWallet: MARKETING_WALLET,
      tokenName: name,
      tokenSymbol: symbol,
      totalSupply: totalSupply.toString(),
      decimals: decimals.toString(),
      deploymentDate: new Date().toISOString(),
      deploymentTransaction: balmzToken.deploymentTransaction().hash,
    };

    const dir = "deployments";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const filename = `deployments/balmz-${hre.network.name}-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to:", filename);

    console.log("\n✨ Deployment completed successfully!\n");
    return contractAddress;

  } catch (error) {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exitCode = 1;
  }
}

main();
