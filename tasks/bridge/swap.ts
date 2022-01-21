import fs from "fs";
import { task, types } from "hardhat/config";
import dotenv from "dotenv";

task("swap", "Swaps NFT between networks")
  .addParam("id", "Token id", 1, types.int)
  .addParam("to", "Address in chain to swap to", "", types.string)
  .addParam("chain", "Chain id to swap to", 97, types.int)
  .addOptionalParam("bridge", "The adddress of the Bridge. By default grab it from .env")
  .setAction(async (taskArgs, hre) => {
    const network = hre.network.name;
    const envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
    for (const parameter in envConfig) {
      process.env[parameter] = envConfig[parameter];
    }

    const bridge = await hre.ethers.getContractAt(
      process.env.BRIDGE_NAME as string,
      taskArgs.bridge || (process.env.BRIDGE_ADDRESS as string)
    );

    console.log(taskArgs);

    console.log(`Swapping item #${taskArgs.id} to chain id ${taskArgs.chain} ...`);
    await bridge.swap(taskArgs.id, taskArgs.to, taskArgs.chain);
    console.log(`Done!`);
  });
