import fs from "fs";
import dotenv from "dotenv";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Asset721__factory } from "../typechain-types";

const network = hre.network.name;
const envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
for (const parameter in envConfig) {
  process.env[parameter] = envConfig[parameter];
}

async function main() {
  const [owner]: SignerWithAddress[] = await hre.ethers.getSigners();
  console.log("Owner address: ", owner.address);

  const balance = await owner.getBalance();
  console.log(
    `Owner account balance: ${hre.ethers.utils.formatEther(balance).toString()}`
  );

  const asset = await new Asset721__factory(owner).deploy(
    process.env.NFT_NAME_FULL as string,
    process.env.NFT_SYMBOL as string,
    process.env.NFT_RANGE_UNIT as string
  );
  await asset.deployed();

  console.log(`Assets721 deployed to ${asset.address} on network ${network}`);

  // Sync env file
  fs.appendFileSync(
    `.env-${network}`,
    `\r# Deployed at \rNFT_ADDRESS=${asset.address}\r`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
