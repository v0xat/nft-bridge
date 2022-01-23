import "dotenv/config";
import express, { Application, Request, Response } from "express";
import { ethers } from "ethers";

import EthBridgeArtifact from "./contracts/BridgeEth.json";
import BscBridgeArtifact from "./contracts/BridgeBsc.json";

const chainIds = {
  rinkeby: 4,
  ropsten: 3,
  kovan: 42,
  bscTestnet: 97,
};

const app: Application = express();
const port = 3000;

const ethProvider = new ethers.providers.AlchemyProvider(
  "kovan",
  process.env.ALCHEMY_API_KEY
);

const bscProvider = new ethers.providers.JsonRpcProvider(
  "https://data-seed-prebsc-1-s1.binance.org:8545/"
);

// Signers
const ethWallet = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, ethProvider);
const ethSigner = ethWallet.connect(ethProvider);

const bscWallet = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, bscProvider);
const bscSigner = bscWallet.connect(bscProvider);

// Bridges
const ethBridge = new ethers.Contract(
  process.env.BRIDGE_ETH_ADDRESS,
  EthBridgeArtifact.abi,
  ethSigner
);

const bscBridge = new ethers.Contract(
  process.env.BRIDGE_BSC_ADDRESS,
  BscBridgeArtifact.abi,
  bscSigner
);

console.log(`ethSigner:  ${ethSigner.address}`);
console.log(`ethBridge:  ${ethBridge.address}`);
console.log("#################");
console.log(`bscSigner:  ${bscSigner.address}`);
console.log(`bscBridge:  ${bscBridge.address}`);

// Listening to SwapInitialized events
ethBridge.on(
  "SwapInitialized",
  async (itemId, chainTo, chainFrom, swapper, to, uri, event) => {
    const hashToSign = event.transactionHash;

    console.log("\n###########\n");
    console.log(`Swap initialized, txHash:  ${event.transactionHash}`);
    console.log(`tokenId:  ${itemId}`);
    console.log(`chainTo:  ${chainTo}`);
    console.log(`chainFrom:  ${chainFrom}`);
    console.log(`swapper:  ${swapper}`);
    console.log(`to:  ${to}`);
    console.log(`uri:  ${uri}`);

    const testBytes = ethers.utils.arrayify(hashToSign);
    const messageHash = ethers.utils.hashMessage(testBytes);

    const signature = await bscSigner.signMessage(testBytes);
    const recovered = ethers.utils.verifyMessage(testBytes, signature);

    console.log("\nRecovered: ", recovered);
    const sig = ethers.utils.splitSignature(signature);

    console.log("\nSigner balance: ", await bscSigner.getBalance());

    await bscBridge.redeem(messageHash, sig, itemId, uri, to, chainFrom, {
      gasLimit: 9000000,
    });

    console.log("\nWaiting for redeem event...");
  }
);

bscBridge.on(
  "SwapInitialized",
  async (itemId, chainTo, chainFrom, swapper, to, uri, event) => {
    const hashToSign = event.transactionHash;

    console.log("\n###########\n");
    console.log(`Swap initialized, txHash:  ${event.transactionHash}`);
    console.log(`tokenId:  ${itemId}`);
    console.log(`chainTo:  ${chainTo}`);
    console.log(`chainFrom:  ${chainFrom}`);
    console.log(`swapper:  ${swapper}`);
    console.log(`to:  ${to}`);
    console.log(`uri:  ${uri}`);

    const testBytes = ethers.utils.arrayify(hashToSign);
    const messageHash = ethers.utils.hashMessage(testBytes);

    const signature = await ethSigner.signMessage(testBytes);
    const recovered = ethers.utils.verifyMessage(testBytes, signature);

    console.log("\nRecovered: ", recovered);
    const splitSig = ethers.utils.splitSignature(signature);

    console.log("\nSigner Balance: ", await ethSigner.getBalance());

    await ethBridge.redeem(messageHash, splitSig, itemId, uri, to, chainFrom, {
      gasLimit: 9000000,
    });

    console.log("\nWaiting for redeem event...");
  }
);

ethBridge.on("SwapRedeemed", async (hash, itemId, chainFrom, to, event) => {
  console.log("\n###########\n");
  console.log(`Swap Redeemd, txHash:  ${event.transactionHash}`);
  console.log(`hash:  ${hash}`);
  console.log(`itemId:  ${itemId}`);
  console.log(`chainFrom:  ${chainFrom}`);
  console.log(`to:  ${to}`);
});

bscBridge.on("SwapRedeemed", async (hash, itemId, chainFrom, to, event) => {
  console.log("\n###########\n");
  console.log(`Swap Redeemd, txHash:  ${event.transactionHash}`);
  console.log(`hash:  ${hash}`);
  console.log(`itemId:  ${itemId}`);
  console.log(`chainFrom:  ${chainFrom}`);
  console.log(`to:  ${to}`);
});

app.get(
  "/swap/status",
  async (req: Request, res: Response): Promise<Response> =>
    res.status(200).send({ message: "Hello World!" })
);

try {
  app.listen(port, () => {
    console.log(`Connected successfully on port ${port}`);
  });
} catch (error) {
  console.error(`Error occured: ${error.message}`);
}
