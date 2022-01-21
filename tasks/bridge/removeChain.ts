import fs from "fs";
import { task } from "hardhat/config";
import dotenv from "dotenv";

task("removeChain", "Removes chain from the list of supported by the bridge")
  .addParam("id", "Chain id")
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

    console.log(`Removing chain ${taskArgs.id} from ${bridge.address} ...`);
    await bridge.removeChain(taskArgs.id);
    console.log(`Done!`);
  });
