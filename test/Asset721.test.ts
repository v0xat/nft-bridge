import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Asset721__factory, Asset721 } from "../types";

import * as utils from "./utils";

const name = "Asset721";
const symbol = "nft721";
const uri = "https://gateway.pinata.cloud/ipfs/uri/1.json";

const rangeUnit = 10000;
const chainId: any = network.config.chainId;
const itemId1 = chainId * rangeUnit;
const itemId2 = chainId * rangeUnit + 1;

describe("Asset721", function () {
  let nft: Asset721,
    owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    snapId: string;

  before(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    nft = await new Asset721__factory(owner).deploy(name, symbol, rangeUnit);
    await nft.deployed();
  });

  beforeEach(async () => {
    snapId = await utils.evmTakeSnap();
    await nft["safeMint(address,string)"](owner.address, uri);
    await nft["safeMint(address,string)"](alice.address, uri);
  });

  afterEach(async () => {
    await utils.evmRestoreSnap(snapId);
  });

  describe("Deployment", function () {
    it("Has a name", async () => {
      expect(await nft.name()).to.be.equal(name);
    });

    it("Has a symbol", async () => {
      expect(await nft.symbol()).to.be.equal(symbol);
    });

    it("Supports interface", async () => {
      expect(await nft.supportsInterface(utils.interfaceIds.erc721)).to.equal(true);
    });
  });

  describe("AccessControl", function () {
    it("Only owner can mint items", async () => {
      await expect(
        nft.connect(alice)["safeMint(address,string)"](bob.address, uri)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${
          utils.roles.minter
        }`
      );
      await expect(
        nft.connect(bob)["safeMint(uint256,address,string)"](1337, bob.address, uri)
      ).to.be.revertedWith(
        `AccessControl: account ${bob.address.toLowerCase()} is missing role ${
          utils.roles.minter
        }`
      );
    });

    it("Only owner can burn", async () => {
      await expect(nft.connect(bob).burn(itemId1)).to.be.revertedWith(
        `AccessControl: account ${bob.address.toLowerCase()} is missing role ${
          utils.roles.burner
        }`
      );

      await expect(nft.burn(itemId1))
        .to.emit(nft, "Transfer")
        .withArgs(owner.address, utils.zeroAddr, itemId1);
    });
  });

  describe("Mint", function () {
    it("Can mint with id", async () => {
      await expect(nft["safeMint(uint256,address,string)"](1337, bob.address, uri))
        .to.emit(nft, "Transfer")
        .withArgs(utils.zeroAddr, bob.address, 1337);
    });
  });

  describe("Approve", function () {
    it("Approve emits event", async () => {
      await expect(nft.approve(alice.address, itemId1))
        .to.emit(nft, "Approval")
        .withArgs(owner.address, alice.address, itemId1);
    });

    it("Can get approved account", async () => {
      await nft.approve(alice.address, itemId1);
      expect(await nft.getApproved(itemId1)).to.be.equal(alice.address);
      expect(await nft.getApproved(itemId2)).to.be.equal(utils.zeroAddr);
    });

    it("Approval for all emits event", async () => {
      await expect(nft.setApprovalForAll(alice.address, true))
        .to.emit(nft, "ApprovalForAll")
        .withArgs(owner.address, alice.address, true);
    });

    it("Can check whether all owner items are approved", async () => {
      await nft.setApprovalForAll(bob.address, true);
      expect(await nft.isApprovedForAll(owner.address, bob.address)).to.be.equal(true);
      expect(await nft.isApprovedForAll(bob.address, owner.address)).to.be.equal(false);
    });

    it("Can't get approved for nonexistent token", async () => {
      await expect(nft.getApproved(1337)).to.be.revertedWith(
        "ERC721: approved query for nonexistent token"
      );
    });

    it("Can't approve to current owner", async () => {
      await expect(nft.approve(owner.address, itemId1)).to.be.revertedWith(
        "ERC721: approval to current owner"
      );
    });

    it("Can't approve if caller is not owner nor approved for all", async () => {
      await expect(nft.approve(bob.address, itemId2)).to.be.revertedWith(
        "ERC721: approve caller is not owner nor approved for all"
      );
    });
  });

  describe("Transfers", function () {
    it("Transfer from emits event", async () => {
      await expect(nft.transferFrom(owner.address, alice.address, itemId1))
        .to.emit(nft, "Transfer")
        .withArgs(owner.address, alice.address, itemId1);
    });

    it("Safe Transfer from emits event", async () => {
      await expect(
        nft["safeTransferFrom(address,address,uint256)"](
          owner.address,
          alice.address,
          itemId1
        )
      )
        .to.emit(nft, "Transfer")
        .withArgs(owner.address, alice.address, itemId1);
    });

    it("Can't transfer from if caller is not owner nor approved for all", async () => {
      await expect(
        nft.transferFrom(owner.address, alice.address, itemId2)
      ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
      await expect(
        nft["safeTransferFrom(address,address,uint256)"](
          owner.address,
          alice.address,
          itemId2
        )
      ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");
    });
  });

  describe("Getting item data", function () {
    it("Can check tokenId exists", async () => {
      expect(await nft.exists(itemId1)).to.be.equal(true);
      expect(await nft.exists(1337)).to.be.equal(false);
    });

    it("Can check user owns item id", async () => {
      expect(await nft.accountOwnsToken(owner.address, itemId1)).to.be.equal(true);
      expect(await nft.accountOwnsToken(owner.address, itemId2)).to.be.equal(false);
    });

    it("Can get tokenURI by id", async () => {
      expect(await nft.tokenURI(itemId1)).to.be.equal(uri);
    });

    it("Can get item owner by id", async () => {
      expect(await nft.ownerOf(itemId1)).to.be.equal(owner.address);
    });

    it("Can get user balances", async () => {
      expect(await nft.balanceOf(owner.address)).to.be.equal(1);
    });

    it("Can't get owner for nonexistent token", async () => {
      await expect(nft.ownerOf(1337)).to.be.revertedWith(
        "ERC721: owner query for nonexistent token"
      );
    });

    it("Can't get balance of zero address", async () => {
      await expect(nft.balanceOf(utils.zeroAddr)).to.be.revertedWith(
        "ERC721: balance query for the zero address"
      );
    });
  });
});
