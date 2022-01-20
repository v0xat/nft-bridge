import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Asset721Mock__factory,
  Asset721Mock,
  BridgeMock__factory,
  BridgeMock,
} from "../typechain-types";

import * as utils from "./utils";

// Asset 721 metadata
const name = "Asset721";
const symbol = "nft";
const rangeUnit = 10000;
const uri = "https://gateway.pinata.cloud/ipfs/uri/{id}.json";

// Bridge data
const version = "1";
const firstChain = {
  chainId: 1,
  itemId1: 1 * rangeUnit, // chainId * rangeUnit
  itemId2: 1 * rangeUnit + 1,
};

const secondChain = {
  chainId: 2,
  itemId1: 2 * rangeUnit, // chainId * rangeUnit
  itemId2: 2 * rangeUnit + 1,
};

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
  let mainNFT: Asset721Mock,
    sideNFT: Asset721Mock,
    mainBridge: BridgeMock,
    sideBridge: BridgeMock,
    owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    gateway: SignerWithAddress,
    snapId: string,
    msgHash: string,
    signature: string,
    invalidSignature: string,
    bytesHash: Uint8Array;

  before(async () => {
    [owner, alice, bob, gateway] = await ethers.getSigners();

    // Deploy assets
    mainNFT = await new Asset721Mock__factory(owner).deploy(
      name,
      symbol,
      rangeUnit,
      firstChain.chainId
    );
    await mainNFT.deployed();
    sideNFT = await new Asset721Mock__factory(owner).deploy(
      name,
      symbol,
      rangeUnit,
      secondChain.chainId
    );
    await sideNFT.deployed();

    mainBridge = await new BridgeMock__factory(owner).deploy(
      name,
      version,
      mainNFT.address,
      gateway.address,
      firstChain.chainId
    );
    await mainBridge.deployed();

    sideBridge = await new BridgeMock__factory(owner).deploy(
      name,
      version,
      sideNFT.address,
      gateway.address,
      secondChain.chainId
    );
    await sideBridge.deployed();

    // Grant roles to bridges (to call safeBridgeMint)
    await mainNFT.grantRole(utils.bridgeRole, mainBridge.address);
    await sideNFT.grantRole(utils.bridgeRole, sideBridge.address);
  });

  beforeEach(async () => {
    snapId = await utils.evmTakeSnap();
  });

  afterEach(async () => {
    await utils.evmRestoreSnap(snapId);
  });

  describe("Deployment", function () {
    it("Should deploy main bridge with correct params", async () => {
      expect(await mainBridge.asset()).to.equal(mainNFT.address);
      expect(await mainBridge.gateway()).to.equal(gateway.address);
    });

    it("Should deploy side bridge with correct params", async () => {
      expect(await mainBridge.asset()).to.equal(mainNFT.address);
      expect(await mainBridge.gateway()).to.equal(gateway.address);
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
        .withArgs(utils.zeroAddr, owner.address, firstChain.itemId1);
      await expect(mainNFT.safeMint(owner.address, uri))
        .to.emit(mainNFT, "Transfer")
        .withArgs(utils.zeroAddr, owner.address, firstChain.itemId2);
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
      await mainBridge.connect(gateway).addChain(secondChain.chainId);
      await sideBridge.connect(gateway).addChain(firstChain.chainId);
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
        // Approve item to bridge
        await mainNFT.approve(mainBridge.address, firstChain.itemId1);
        // Make swap
        const tx = await mainBridge.swap(
          firstChain.itemId1,
          alice.address,
          secondChain.chainId
        );
        // Save hash and signature
        bytesHash = await getHashBytesFromEvent(tx);
        msgHash = ethers.utils.hashMessage(bytesHash);
        signature = await signHash(gateway, bytesHash);
        invalidSignature = await signHash(bob, bytesHash);
      });

      it("Redeem emits events", async () => {
        const recovered = ethers.utils.verifyMessage(bytesHash, signature);
        expect(recovered).to.equal(gateway.address);
        await expect(
          sideBridge
            .connect(gateway)
            .redeem(
              msgHash,
              ethers.utils.splitSignature(signature),
              firstChain.itemId1,
              uri,
              alice.address,
              firstChain.chainId
            )
        )
          .to.emit(sideBridge, "SwapRedeemed")
          .withArgs(msgHash, firstChain.itemId1, firstChain.chainId, alice.address)
          .and.to.emit(sideNFT, "Transfer")
          // Check item was minted (transfer from zero)
          .withArgs(utils.zeroAddr, alice.address, firstChain.itemId1);

        expect(await sideBridge.redeemed(msgHash)).to.be.equal(true);
      });

      it("Only gateway can execute redeem", async () => {
        await expect(
          sideBridge.redeem(
            msgHash,
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
          .connect(gateway)
          .redeem(
            msgHash,
            ethers.utils.splitSignature(signature),
            firstChain.itemId1,
            uri,
            alice.address,
            firstChain.chainId
          );
        await expect(
          sideBridge
            .connect(gateway)
            .redeem(
              msgHash,
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
            .connect(gateway)
            .redeem(
              msgHash,
              ethers.utils.splitSignature(invalidSignature),
              firstChain.itemId1,
              uri,
              alice.address,
              firstChain.chainId
            )
        ).to.be.revertedWith("ECDSA: invalid signature");
      });

      describe("After redeem", function () {
        beforeEach(async () => {
          await sideBridge
            .connect(gateway)
            .redeem(
              msgHash,
              ethers.utils.splitSignature(signature),
              firstChain.itemId1,
              uri,
              alice.address,
              firstChain.chainId
            );
        });

        it("Item must be locked on chainFrom bridge", async () => {
          expect(await mainNFT.ownerOf(firstChain.itemId1)).to.equal(mainBridge.address);
        });

        it("Item URI must not change in chainTo", async () => {
          expect(await sideNFT.tokenURI(firstChain.itemId1)).to.equal(
            await mainNFT.tokenURI(firstChain.itemId1)
          );
        });

        describe("Swap back to main chain", function () {
          beforeEach(async () => {
            // Approve item to bridge
            await sideNFT.connect(alice).approve(sideBridge.address, firstChain.itemId1);
          });

          it("Swap on side chain emits events", async () => {
            await expect(
              sideBridge
                .connect(alice)
                .swap(firstChain.itemId1, owner.address, firstChain.chainId)
            )
              .to.emit(sideBridge, "SwapInitialized")
              .and.to.emit(sideNFT, "Transfer")
              .withArgs(alice.address, sideBridge.address, firstChain.itemId1);
          });

          it("Redeem on main chain, item should NOT be minted", async () => {
            const tx = await sideBridge
              .connect(alice)
              .swap(firstChain.itemId1, owner.address, firstChain.chainId);
            bytesHash = await getHashBytesFromEvent(tx);
            msgHash = ethers.utils.hashMessage(bytesHash);
            signature = await signHash(gateway, bytesHash);

            await expect(
              mainBridge
                .connect(gateway)
                .redeem(
                  msgHash,
                  ethers.utils.splitSignature(signature),
                  firstChain.itemId1,
                  uri,
                  owner.address,
                  secondChain.chainId
                )
            )
              .to.emit(mainBridge, "SwapRedeemed")
              .withArgs(msgHash, firstChain.itemId1, secondChain.chainId, owner.address)
              .and.to.emit(mainNFT, "Transfer")
              // Check item was NOT minted (transfer locked item from bridge)
              .withArgs(mainBridge.address, owner.address, firstChain.itemId1);

            expect(await mainBridge.redeemed(msgHash)).to.be.equal(true);
          });
        });
      });
    });
  });
});
