import { ethers, network } from "hardhat";

const zeroAddr = ethers.constants.AddressZero;

// AccessControl roles in bytes32 string
const adminRole = ethers.constants.HashZero; // DEFAULT_ADMIN_ROLE
const bridgeRole = ethers.utils.solidityKeccak256(["string"], ["BRIDGE_ROLE"]);

const interfaceIds = {
  erc721: "0x80ac58cd",
};

const evmTakeSnap = async (): Promise<any> => {
  return await network.provider.request({
    method: "evm_snapshot",
    params: [],
  });
};

const evmRestoreSnap = async (id: string) => {
  await network.provider.request({
    method: "evm_revert",
    params: [id],
  });
};

export { zeroAddr, adminRole, bridgeRole, interfaceIds, evmTakeSnap, evmRestoreSnap };
