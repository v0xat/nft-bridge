import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as snapshot from "./utils";

// Asset 721 metadata
const name = "Asset721";
const symbol = "nft";
const rangeUnit = 10000;
const uri = "https://gateway.pinata.cloud/ipfs/uri/{id}.json";

// Test data
const zeroAddr = ethers.constants.AddressZero;

const firstChain = {
  chainId: 1,
  itemId1: 1 * rangeUnit, // id * rangeUnit
  itemId2: 1 * rangeUnit + 1,
};

const secondChain = {
  chainId: 2,
  itemId1: 2 * rangeUnit, // id * rangeUnit
  itemId2: 2 * rangeUnit + 1,
};

// Bridge data
const version = "1";

// AccessControl roles in bytes32 string
// DEFAULT_ADMIN_ROLE, MINTER_ROLE, BURNER_ROLE, CREATOR_ROLE
const adminRole = ethers.constants.HashZero;
const bridgeRole = ethers.utils.solidityKeccak256(["string"], ["BRIDGE_ROLE"]);

const getHashBytesFromEvent = async (tx: any) => {
  const receipt = await tx.wait();
  const event = receipt.events?.filter((x: any) => {
    return x.event === "SwapInitialized";
  });
  return ethers.utils.arrayify(event[0].args.hash);
};

const signHash = async (signer: SignerWithAddress, bytes: Uint8Array) => {
  return await signer.signMessage(bytes);
};

describe("Bridge", function () {
  let mainNFT: Contract,
    sideNFT: Contract,
    mainBridge: Contract,
    sideBridge: Contract,
    Asset721: ContractFactory,
    Bridge: ContractFactory,
    owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    addrs: SignerWithAddress[],
    snapId: string,
    signature: string,
    invalidSignature: string,
    bytesHash: Uint8Array;

  before(async () => {
    [owner, alice, bob, ...addrs] = await ethers.getSigners();
    // Using AssetMock in which we can pass chainId to emulate different chains in tests.
    Asset721 = await ethers.getContractFactory("Asset721Mock");
    // Using BridgeMock in which we can pass chainId to emulate different chains in tests.
    Bridge = await ethers.getContractFactory("BridgeMock");

    // Deploy assets
    mainNFT = await Asset721.deploy(name, symbol, rangeUnit, firstChain.chainId);
    await mainNFT.deployed();
    sideNFT = await Asset721.deploy(name, symbol, rangeUnit, secondChain.chainId);
    await sideNFT.deployed();

    mainBridge = await Bridge.deploy(
      name,
      version,
      mainNFT.address,
      bob.address,
      firstChain.chainId
    );
    await mainBridge.deployed();

    sideBridge = await Bridge.deploy(
      name,
      version,
      sideNFT.address,
      bob.address,
      secondChain.chainId
    );
    await sideBridge.deployed();

    // Grant roles to bridges (to call safeBridgeMint)
    await mainNFT.grantRole(bridgeRole, mainBridge.address);
    await sideNFT.grantRole(bridgeRole, sideBridge.address);
  });

  beforeEach(async () => {
    snapId = await snapshot.take();
  });

  afterEach(async () => {
    await snapshot.restore(snapId);
  });

  describe("Deployment", function () {
    it("Should deploy main bridge with correct params", async () => {
      expect(await mainBridge.asset()).to.equal(mainNFT.address);
      expect(await mainBridge.gateway()).to.equal(bob.address);
    });

    it("Should deploy side bridge with correct params", async () => {
      expect(await mainBridge.asset()).to.equal(mainNFT.address);
      expect(await mainBridge.gateway()).to.equal(bob.address);
    });

    it("Should deploy main nft with correct params", async () => {
      expect(await mainNFT.chainId()).to.equal(firstChain.chainId);
    });

    it("Should deploy side nft with correct params", async () => {
      expect(await sideNFT.chainId()).to.equal(secondChain.chainId);
    });
  });

  describe("Minting", function () {
    it("Mint assignes correct ids based on chain id", async () => {
      await expect(mainNFT.safeMint(owner.address, uri))
        .to.emit(mainNFT, "Transfer")
        .withArgs(zeroAddr, owner.address, firstChain.itemId1);
      await expect(mainNFT.safeMint(owner.address, uri))
        .to.emit(mainNFT, "Transfer")
        .withArgs(zeroAddr, owner.address, firstChain.itemId2);
    });
  });

  describe("Bridge", function () {
    beforeEach(async () => {
      // Minting tokens on both sides
      await mainNFT.safeMint(owner.address, uri);
      await mainNFT.safeMint(alice.address, uri);

      await sideNFT.safeMint(owner.address, uri);
      await sideNFT.safeMint(alice.address, uri);

      // Updating chain support
      await mainBridge.connect(bob).addChain(secondChain.chainId);
      await sideBridge.connect(bob).addChain(secondChain.chainId);
    });

    it("Only gateway can add new chains", async () => {
      await expect(mainBridge.addChain(42)).to.be.revertedWith(
        "Only gateway can add chain"
      );
    });

    describe("Swap", function () {
      it("Calling swap emits event", async () => {
        await mainNFT.approve(mainBridge.address, firstChain.itemId1);

        await expect(
          mainBridge.swap(firstChain.itemId1, alice.address, secondChain.chainId)
        )
          .to.emit(mainBridge, "SwapInitialized")
          // .withArgs(
          //   firstChain.itemId1,
          //   secondChain.id,
          //   firstChain.id,
          //   owner.address,
          //   alice.address,
          //   uri
          // )
          .and.to.emit(mainNFT, "Transfer")
          .withArgs(owner.address, mainBridge.address, firstChain.itemId1);
      });

      it("Can't swap to unsupported chain", async () => {
        await mainNFT.approve(mainBridge.address, firstChain.itemId1);
        await expect(
          mainBridge.swap(firstChain.itemId1, alice.address, 42)
        ).to.be.revertedWith("Swap to an unsupported chain");
      });

      it("Can swap only own tokens", async () => {
        await expect(
          mainBridge.swap(firstChain.itemId2, alice.address, secondChain.chainId)
        ).to.be.revertedWith("Caller is not owner");
      });
    });

    describe("Redeem", function () {
      beforeEach(async () => {
        // Make swap before testing redeem
        await mainNFT.approve(mainBridge.address, firstChain.itemId1);
        const tx = await mainBridge.swap(
          firstChain.itemId1,
          alice.address,
          secondChain.chainId
        );
        bytesHash = await getHashBytesFromEvent(tx);
        signature = await signHash(bob, bytesHash);
        invalidSignature = await signHash(owner, bytesHash);
      });

      it("Redeem emits event", async () => {
        const recovered = ethers.utils.verifyMessage(bytesHash, signature);
        expect(recovered).to.equal(bob.address);
        await expect(
          sideBridge
            .connect(bob)
            .redeem(
              ethers.utils.hashMessage(bytesHash),
              ethers.utils.splitSignature(signature),
              firstChain.itemId1,
              uri,
              alice.address,
              firstChain.chainId
            )
        )
          .to.emit(sideBridge, "SwapRedeemed")
          .withArgs(
            ethers.utils.hashMessage(bytesHash),
            firstChain.itemId1,
            firstChain.chainId,
            alice.address
          )
          .and.to.emit(sideNFT, "Transfer")
          .withArgs(zeroAddr, alice.address, firstChain.itemId1);
      });

      it("Only gateway can execute redeem", async () => {
        await expect(
          sideBridge.redeem(
            ethers.utils.hashMessage(bytesHash),
            ethers.utils.splitSignature(signature),
            firstChain.itemId1,
            uri,
            alice.address,
            firstChain.chainId
          )
        ).to.be.revertedWith("Only gateway can execute redeem");
      });

      it("Can't redeem twice", async () => {
        await sideBridge
          .connect(bob)
          .redeem(
            ethers.utils.hashMessage(bytesHash),
            ethers.utils.splitSignature(signature),
            firstChain.itemId1,
            uri,
            alice.address,
            firstChain.chainId
          );
        await expect(
          sideBridge
            .connect(bob)
            .redeem(
              ethers.utils.hashMessage(bytesHash),
              ethers.utils.splitSignature(signature),
              firstChain.itemId1,
              uri,
              alice.address,
              firstChain.chainId
            )
        ).to.be.revertedWith("Can't redeem twice");
      });

      it("ECDSA: invalid signature", async () => {
        await expect(
          sideBridge
            .connect(bob)
            .redeem(
              ethers.utils.hashMessage(bytesHash),
              ethers.utils.splitSignature(invalidSignature),
              firstChain.itemId1,
              uri,
              alice.address,
              firstChain.chainId
            )
        ).to.be.revertedWith("ECDSA: invalid signature");
      });
    });

    // it("Swapping from Main to Side and backwards", async () => {
      
    // });
  });
});
