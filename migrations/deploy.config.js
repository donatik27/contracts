const BN = require('bn.js')

const TOKEN_UNIT = new BN('10').pow(new BN('18'))

module.exports = {
  curation: {
    reserveRatio: 500000,
    minimumCurationStake: new BN('100').mul(TOKEN_UNIT),
    withdrawalFeePercentage: 50000,
  },
  dispute: {
    minimumDeposit: new BN('100').mul(TOKEN_UNIT),
    fishermanRewardPercentage: 1000, // in basis points
    slashingPercentage: 1000, // in basis points
  },
  epochs: {
    lengthInBlocks: (24 * 60 * 60) / 15, // One day in blocks
  },
  staking: {
    channelDisputeEpochs: 1,
    maxAllocationEpochs: 5,
    thawingPeriod: 20, // in blocks
  },
  token: {
    initialSupply: new BN('10000000').mul(TOKEN_UNIT),
  },
  etherDIDRegistry: {
    address: '0xdca7ef03e98e0dc2b855be647c39abe984fcf21b', // same for all networks
  },
  node: {
    // TODO
    signerAddress: '0x0000000000000000000000000000000000000000',
  },
}