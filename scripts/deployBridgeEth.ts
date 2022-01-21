import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import hre, { artifacts } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BridgeEth__factory } from "../types";

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

  const bridge = await new BridgeEth__factory(owner).deploy(
    process.env.BRIDGE_NAME as string,
    process.env.BRIDGE_VERSION as string,
    process.env.BRIDGE_GATEWAY as string,
    process.env.NFT_ADDRESS as string
  );
  await bridge.deployed();

  console.log(
    `${process.env.BRIDGE_NAME} deployed to ${bridge.address} on network ${network}`
  );

  // Sync env file
  fs.appendFileSync(
    `.env-${network}`,
    `\r# Deployed at \rBRIDGE_ADDRESS=${bridge.address}\r`
  );

  // Saving artifacts and address in /backend
  saveBackendFiles(bridge);
}

const saveBackendFiles = (bridge: Contract) => {
  const contractsDir = path.join(__dirname, "/../backend/src/contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  // Sync backend env file
  fs.appendFileSync(
    path.join(__dirname, "/../backend/.env"),
    `\r# Deployed at \rBRIDGE_ETH_ADDRESS=${bridge.address}\r`
  );

  const Artifact = artifacts.readArtifactSync(process.env.BRIDGE_NAME as string);

  fs.writeFileSync(
    path.join(contractsDir, `/${process.env.BRIDGE_NAME}.json`),
    JSON.stringify(Artifact, null, 2)
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
