import fs from "fs";
import { task } from "hardhat/config";
import dotenv from "dotenv";

task("create", "Mints new NFT")
  .addParam("to", "The address to mint to")
  .addParam("uri", "The token URI")
  .addOptionalParam("asset", "The adddress of the Asset. By default grab it from .env")
  .setAction(async (taskArgs, hre) => {
    const network = hre.network.name;
    const envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
    for (const parameter in envConfig) {
      process.env[parameter] = envConfig[parameter];
    }

    const asset = await hre.ethers.getContractAt(
      process.env.NFT_CONTRACT_NAME as string,
      taskArgs.asset || (process.env.NFT_ADDRESS as string)
    );

    console.log(`Minting new item to ${taskArgs.to} ...`);
    await asset.safeMint(taskArgs.to, taskArgs.uri);
    console.log(`Done!`);
  });
