import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";

import { Asset721Mock__factory, Asset721Mock } from "../types";

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
  itemId3: 1 * rangeUnit + 2,
};

const secondChain = {
  chainId: 2,
  itemId1: 2 * rangeUnit, // chainId * rangeUnit
  itemId2: 2 * rangeUnit + 1,
  itemId3: 2 * rangeUnit + 2,
};

const getHashBytesFromEvent = async (tx: any) => {
  const receipt = await tx.wait();
  const event = receipt.events?.filter((x: any) => {
    return x.event === "SwapInitialized";
  });
  // console.log(event[0]);
  return ethers.utils.arrayify(event[0].transactionHash);
};

const signHash = async (signer: SignerWithAddress, bytes: Uint8Array) => {
  return await signer.signMessage(bytes);
};

describe("Bridge", function () {
  let mainNFT: Asset721Mock,
    sideNFT: Asset721Mock,
    mainBridge: Contract,
    sideBridge: Contract,
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

    // Deploy two bridges with different chainIds
    const MainBridge = await ethers.getContractFactory("BridgeEthMock");
    mainBridge = await upgrades.deployProxy(
      MainBridge,
      [gateway.address, mainNFT.address, firstChain.chainId],
      { initializer: "initializeBridge" }
    );
    await mainBridge.deployed();

    // Deploy two bridges with different chainIds
    const SideBridge = await ethers.getContractFactory("BridgeBscMock");
    sideBridge = await upgrades.deployProxy(
      SideBridge,
      [gateway.address, sideNFT.address, secondChain.chainId],
      { initializer: "initializeBridge" }
    );
    await sideBridge.deployed();

    // Grant roles to bridges (to call safeBridgeMint)
    await mainNFT.grantRole(utils.roles.minter, mainBridge.address);
    await sideNFT.grantRole(utils.roles.minter, sideBridge.address);

    // Minting tokens on both sides
    await mainNFT["safeMint(address,string)"](owner.address, uri);
    await mainNFT["safeMint(address,string)"](alice.address, uri);

    await sideNFT["safeMint(address,string)"](owner.address, uri);
    await sideNFT["safeMint(address,string)"](alice.address, uri);

    // Updating chain support
    await mainBridge.addChain(secondChain.chainId);
    await sideBridge.addChain(firstChain.chainId);

    // Approve item
    await mainNFT.approve(mainBridge.address, firstChain.itemId1);
  });

  beforeEach(async () => {
    snapId = await utils.evmTakeSnap();
  });

  afterEach(async () => {
    await utils.evmRestoreSnap(snapId);
  });

  describe("Deployment", function () {
    it("Should set correct owners", async () => {
      expect(await sideBridge.owner()).to.be.equal(owner.address);
      expect(await mainBridge.owner()).to.be.equal(owner.address);
    });
  });

  describe("Upgradable", function () {
    it("Works", async () => {
      const MainBridgeV2 = await ethers.getContractFactory("BridgeEthMockV2");
      const upgradedMain = await upgrades.upgradeProxy(mainBridge.address, MainBridgeV2);
      expect(await upgradedMain.owner()).to.be.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Mint assignes correct ids based on chain id", async () => {
      await expect(mainNFT["safeMint(address,string)"](owner.address, uri))
        .to.emit(mainNFT, "Transfer")
        .withArgs(utils.zeroAddr, owner.address, firstChain.itemId3);
      await expect(sideNFT["safeMint(address,string)"](owner.address, uri))
        .to.emit(sideNFT, "Transfer")
        .withArgs(utils.zeroAddr, owner.address, secondChain.itemId3);
    });
  });

  describe("Pausable", function () {
    it("Should be able to pause & unpause contract", async () => {
      await mainBridge.pause();
      await expect(
        mainBridge.swap(firstChain.itemId1, alice.address, secondChain.chainId)
      ).to.be.revertedWith("Pausable: paused");
      await mainBridge.unpause();
      await mainBridge.swap(firstChain.itemId1, alice.address, secondChain.chainId);
    });

    it("Only admin should be able to pause contract", async () => {
      await expect(mainBridge.connect(alice).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Supported chains", function () {
    it("Chain adding emits event", async () => {
      await expect(mainBridge.addChain(1337))
        .to.emit(mainBridge, "ChainAdded")
        .withArgs(1337, owner.address);
    });

    it("Chain removing emits event", async () => {
      await expect(mainBridge.removeChain(secondChain.chainId))
        .to.emit(mainBridge, "ChainRemoved")
        .withArgs(secondChain.chainId, owner.address);
    });

    it("Only owner can add / remove supported chains", async () => {
      await expect(mainBridge.connect(alice).addChain(1337)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(mainBridge.connect(bob).removeChain(2)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Bridge", function () {
    describe("Swap", function () {
      it("Calling swap emits event", async () => {
        await expect(
          mainBridge.swap(firstChain.itemId1, alice.address, secondChain.chainId)
        )
          .to.emit(mainBridge, "SwapInitialized")
          .withArgs(
            firstChain.itemId1,
            secondChain.chainId,
            firstChain.chainId,
            owner.address,
            alice.address,
            uri
          )
          .and.to.emit(mainNFT, "Transfer")
          .withArgs(owner.address, mainBridge.address, firstChain.itemId1);
      });

      it("Can't swap to unsupported chain", async () => {
        await expect(
          mainBridge.swap(firstChain.itemId1, alice.address, 42)
        ).to.be.revertedWith("Swap to an unsupported chain");
      });

      it("Can swap only own tokens", async () => {
        await expect(
          mainBridge.swap(firstChain.itemId2, alice.address, secondChain.chainId)
        ).to.be.revertedWith("Caller is not token owner");
      });
    });

    describe("Redeem", function () {
      beforeEach(async () => {
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

      it("Only validator can execute redeem", async () => {
        await expect(
          sideBridge.redeem(
            msgHash,
            ethers.utils.splitSignature(signature),
            firstChain.itemId1,
            uri,
            alice.address,
            firstChain.chainId
          )
        ).to.be.revertedWith("Only validator can execute redeem");
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
