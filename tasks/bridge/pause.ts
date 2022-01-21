import fs from "fs";
import dotenv from "dotenv";
import { task } from "hardhat/config";

task("pause", "Pause Bridge functions")
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

    console.log(`\nPausing Bridge at ${bridge.address} ...\n`);
    await bridge.pause();
    console.log(`Done!`);
  });
