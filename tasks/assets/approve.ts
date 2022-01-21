import fs from "fs";
import { task, types } from "hardhat/config";
import dotenv from "dotenv";

task("approve", "Approves item to address")
  .addParam("id", "Token id", 1, types.int)
  .addParam("to", "The address to approve to")
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

    console.log(`Approving item to ${taskArgs.to} ...`);
    await asset.approve(taskArgs.to, taskArgs.id);
    console.log(`Done!`);
  });
