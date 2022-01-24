# NFT Bridge

*This is a training project, you should not use any of it's code in production 
because it's not properly audited and tested.*

### Description

This project implements an NFT bridge between EVM compatible networks.
Main idea of this bridge is to preallocate item ids for each network, so we can mint items on 
both sides and be sure that there wiil be no collisions on transfers. 
Very similar to described in [Bridging NFTs across layers](https://ethresear.ch/t/bridging-nfts-across-layers/10799).

Items minted with offset based on `chainId` and range unit. Range unit is passed into 
constructor and can't be changed later, also it must be the same for each network.

Offset calculated as `chainId * rangeUnit`

### Bridge between Kovan and BSC testnets:

Bridge-bsc: [0x9AbbB505cd143315361B8De7C532A5102F0585CA](https://testnet.bscscan.com/address/0x9AbbB505cd143315361B8De7C532A5102F0585CA)

Bridge-eth: [0x3F73Ad5d578F84EbE35bCDCede9aCe419F2549c9](https://kovan.etherscan.io/address/0x3F73Ad5d578F84EbE35bCDCede9aCe419F2549c9)

NFT-bsc: [0x60197220897d484C20c2A8D65443C39caacB7236](https://testnet.bscscan.com/address/0x60197220897d484c20c2a8d65443c39caacb7236)

NFT-eth: [0x3E5A5EFA7a0e8F81204ECA2697f1983eD08Cf420](https://kovan.etherscan.io/address/0x3e5a5efa7a0e8f81204eca2697f1983ed08cf420)

### How to run

Create a `.env` file using the `.env.example` template with the following content
- [ALCHEMY_API_KEY](https://www.alchemy.com/)
- [CMC_API_KEY](https://coinmarketcap.com/api/)
- [BSCSCAN_API_KEY](https://bscscan.com/apis)
- [ETHERSCAN_API_KEY](https://etherscan.io/apis)
- [MNEMONIC](https://docs.metamask.io/guide/common-terms.html#mnemonic-phrase-seed-phrase-seed-words)

Try running some of the following tasks and don't forget to specify network (ex. `--network kovan`):

* `hh` is a [shorthand](https://hardhat.org/guides/shorthand.html) for `npx hardhat`

```shell
hh coverage

hh run scripts/deployAssets.ts
hh run scripts/deployBridgeBsc.ts
hh run scripts/deployBridgeEth.ts
```