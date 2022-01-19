import { ethers, network } from "hardhat";

const zeroAddr = ethers.constants.AddressZero;

const take = async (): Promise<any> => {
  return await network.provider.request({
    method: "evm_snapshot",
    params: [],
  });
};

const restore = async (id: string) => {
  await network.provider.request({
    method: "evm_revert",
    params: [id],
  });
};

export { zeroAddr, take, restore };
