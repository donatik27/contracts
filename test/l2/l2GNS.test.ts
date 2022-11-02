import { expect } from 'chai'
import { ethers, ContractTransaction, BigNumber, Event } from 'ethers'
import { arrayify, defaultAbiCoder, hexlify, parseUnits } from 'ethers/lib/utils'

import {
  getAccounts,
  randomHexBytes,
  Account,
  toGRT,
  getL2SignerFromL1,
  provider,
} from '../lib/testHelpers'
import { L2FixtureContracts, NetworkFixture } from '../lib/fixtures'
import { toBN } from '../lib/testHelpers'

import { L2GNS } from '../../build/types/L2GNS'
import { L2GraphToken } from '../../build/types/L2GraphToken'
import { L2GraphTokenGateway } from '../../build/types/L2GraphTokenGateway'
import {
  buildSubgraph,
  buildSubgraphID,
  DEFAULT_RESERVE_RATIO,
  publishNewSubgraph,
  PublishSubgraph,
} from '../lib/gnsUtils'
import { Curation } from '../../build/types/Curation'
import { GraphToken } from '../../build/types/GraphToken'

const { HashZero } = ethers.constants

interface L1SubgraphParams {
  l1SubgraphId: string
  curatedTokens: BigNumber
  lockBlockhash: string
  metadata: string
  nSignal: BigNumber
}

// Subgraph values taken from a mainnet subgraph, including a proof
// for a specific curator's balance, obtained using eth_getProof:
// await provider.send('eth_getProof', [ g.contracts.GNS.address, [ '0x2757396e3ce68a9104b5d84b5b0988e37067e780df1ad018184da3616033f432' ], '0x82e59e8ef5e6c4352d363fc5b6ea64d6f605d47ff0c454ea1133be6bacaff487'])
// Where the curator slot is 0x2757396e3ce68a9104b5d84b5b0988e37067e780df1ad018184da3616033f432,
// which was obtained by calling this in a localhost hardhat console:
// await g.contracts.GNS.getCuratorSlot('0xE99bD186DBdA4Dc0A499b158E9E8eA7a628EDD14', '0x715f5c54c9a35783823650c340586f43acede4a907726e4e6499abde90331184')
const mainnetSubgraphWithProof = {
  subgraphId: '0x715f5c54c9a35783823650c340586f43acede4a907726e4e6499abde90331184',
  curator: '0xE99bD186DBdA4Dc0A499b158E9E8eA7a628EDD14',
  blockhash: '0x82e59e8ef5e6c4352d363fc5b6ea64d6f605d47ff0c454ea1133be6bacaff487',
  blockNumber: 15884906,
  nSignal: BigNumber.from('36740350312298917761'),
  curatedTokens: BigNumber.from('1349853341070443183932'),
  metadata: '0x7c0b534d4a5ee2a14b3209e678671ad7db2aa23d741a27ad4573daa5da4a67bb', // Obtained with a SubgraphMetadataUpdated event filter
  getProofResponse: {
    accountProof: [
      '0xf90211a08a9701cbb65b3ebd5ffd5d0c4e959a01f0f5777b60a7d3069d560aae9ced519fa05c14f1e3eb1aa27b98c5421813cd0a2ccd607f338aa5c6e51b01b5bbae9b7a22a0a8ef688324a1830e5052802e44e76122378468f08085b74584aab3dd7d655dfca0460ef2adac161e0a86112a2a9246e1d36e8006f344c146b211ec6985f371282fa077fee3062bfd699d695542b880f7cdf1f469500b2b6385cf8fe266bcb619f16ca0799795d800b383e54b1b70b89a462510a26f702e55d6e234ae599885cba183a4a0c21957e0a6895f39ee67c0db2bb2eb732b821fe034549d0f7e68db05fb434db4a0a71cd96e8ef9233fbe6ec72dae6208e06875bc3a2d7aeffc5a68e65a3edd353ca0549db853704cb95f28e3081c3ea5ea9953d6716e5ed1e85f1f07ca06cf3562cca0eb12b05a20566fdc91ff6e87344cb27a7739e2869978592081b3ee5da20e2a72a05cf1f39fc25860045fc1d5b12645d47eda0988b2f847d26bb871dd98f25ef608a05f56eb881b3957f3b0d27463f5db8dc0aa467fcc07420b38e7824e779099c78aa0167782c6e8c2a5c63f823f9a80749dc42807677cdf1baa489b6b3fd29913f66ea092c32da10ee6754d7864639ddd7bc849029bb789a0ac60624c06d54c0c4dea2da04753ee0c68d9ea737a61737780889d3c70853b02c42bdce010141e8974865049a06c66113c6c605086e103ec918a6ac51c0807f1475a8947174c4e7ca0b77d1ab980',
      '0xf90211a092b4f87a7a56eb1b0cc4e37b1a470983de47b6e59bb9f001713eceeaf1e1b778a0570de7dce4feeb8714bfb203a85b6baaa6e828e4de6cef1b03a2214982523c1ea01366fb14fa2dcc99de2a1a32454d26a1f36c4d16d07dd693e33f7a5227dfd260a0aa87fd12b8b39ec060335012e43f95fb6c3eac97557d7ca8e75219be8f3b7da8a02dd06fd857e864e4f451c07c1b8fcbd01826ae296a943bcd1754baf28dfe1fc1a0844c26cacd9dda7a88d11c2fbc60773c7f6260df5c6cfba0204e666ea0dee13ba03bae90508ad2ca51f8e41ae91a7efdef4eb1894e7aa52b2e6d55b36e3621e484a00e85200c5a56f6a221eb10c4497b4a8dcdaf143fc02c84511d99eb51e1714bfca0dcd8e4198135ff184e437dc7f7be85f77c0b22cd5e2a682bea72d34b1732dba5a01d3f9883287cfbf33961c4700b91d31a5c103246302422f7f670ffcdd0d6da9aa02cb5f762b4718da65563d25a86934ef30127b07980013973942ace532d4693fba056bd9dbc1eeedb8dd7f1bc7b6750a58d50ade9ebc4ea1e448f74d0d28c998190a07125ff6fbc2aa718ee13fa1e18e96df6e1e08e6308b41ace8ce2bfd8a76f5ccaa036328b9158819bc7538f16b3915e58c4b188a6c6022715d164a815715b7e3e83a0a60be8f4456b0fad56abe9e9e34b08a5e6aba3363fb7861a69ac2059503f452ba0da1999c819fd92e96c21aec4206d3b4dd7c3ac322c233a237e2be6837ab377b680',
      '0xf90211a0a4ec77fb4bb0a98e8ad69a419e3b0d1250a9609955a6c9bf537ba99e0f20a691a06be377d2802e354d166a7352df70b7912452edc1abeb4b1d4c42273a43a901cda06cc656bcb5ed234290549f9fc0cf2ec31f8ab58d3366b0a55272d4b963d57e98a07af81904e659c472a5aecfbab5b1368504fd8686d6c407af0e4e6a4027cb4374a0f66d3d2df212e13913b17f9f744248253843a5106ac91a9a4ece07576e12cc76a02765d2d176513a83f8ce5b91289571ac61dc0b6af1fbca8de8f737f7c14cf2a9a05774d994c9f98969ed39fbc775e8afd7432148bb46e9fc9b2eb085a4f8737ac3a0d122da0dc7a5a62c1d1708e558b396d38630c1168729f82020dcc9fd1e44448da0b17ed04570d4f4da14053fb9384c7edc8f20c11e76c6fdf3364947005a1608ada0deca116b59ebfa7cd4fb5d869212a7c92af35a3b8ee077a23eb17e37fe98ca40a01209069e0803e14a97d9ca11e34179b8857469ddbd6c6703ba33ab6ade014ef6a004f174729c89807aabd2850d35ed48f594875de96d1f89d93249aa0728c5840aa04dd240d8db8127a59db6131e6d32053fbc1884a5a0438edac929d7838a7053dba0bedb75f907bb25814a45ef07364882910e9730ab535cfadf8278d66c0ed17afaa07c4367a2c963808f0722fe007587fd2031b369198ee0794a29a7938f62eac828a039523e340a8c2968ba22b611a694694d467bfc8e7f8a467cef610cc2e8774be980',
      '0xf90211a07238565a4a96d9c37896f8f48b8daca4e74ea1d4b767d5476a1ca945fe8d9736a0751c83fcffa8f0747cbadb4425e2d83e7c181ba5ba19a6df60931a63546e87aca0f7d9281e8e6c375deea49b98f55f5eb08a9511412e381d7bd96a25a7fbc9ca86a0d7373d9df46a011025971a3be7884a179e5af6fe90868d4105404c06a5c2f908a03c8830d58461246211f9b13dd0afd3ac34e1dac1e55329785e79c1ae14845b6ca06f7454b021f29191f006457aecf4e4695dbd652a4443162cf69cde1845b85df6a08c334bff53b2ba1e8df6f6aee68045ab8ee9f02b38f9766b97de48dcc02edcaea061db2c2f8b55ac092b1e3eba4a1e82f677fa52e4f4095d3dba831cb89f0306c3a04293fdf7986e8a464cf5a976b6ddff82ded83f28eef942ff1d8418d2799b06bfa07505f623087c999f63b8b2407853438ea3f747c4103bacc5fc6c62b330314624a0a2b540fa6b0564f959d8ccdba3659a59a00494fdf9cd1d9f4ea9efbe78227f70a0f9cc8d6b4cf4cb3178733e1daf8dd4e86e8c65d5e153cdae77542fcabdfd75fca0beebf7560922a87838e1c2119dd5f11a23b2f9f492d3d34d6faa8f2052a64722a069a3753b6b036c372444940038e387a6d3f77383cb48a302d0d8742a607652b7a02a1ddc02796d842608f4a372f8cb3beb90996acf8288bbb22d50331b56979c5fa0a0a548553326e53e260ce87c4b0c8271724aacd0115b3d0d28ce43ca208883e380',
      '0xf90211a0e7efc1ad587fb9ecc0c343d94c894146f9ac499ad3b250368c11d6f531354b8fa07237f64ded7d0941d59656e5b590d3e6fc61093cc1740ad209dd300ee9f0ca12a042ac0a64ac87b16ec296edb580ce0910083690d9d1ace367369351a6fbfe0882a05533447ef90d3623bceccef86860a029ea394aa8783ee6cf3e982bd47ff12c03a0df248d8095d09d69e25381eb1ee6a90407fba3fe1baae6fbd56c2660986573bfa0622e8063b57c51b19747bc851ae0d828d1cde0bbf46f8a5180102dd94459c802a0e800b6c40184f7b7fa683ae191bb4aac1ce585bb6791b99eb4244e351d02f1cba04df04e181c844dd951cb08153bbf92c456bdbc68891bee2b5699f7dfb55b90a7a0833a530c25ed992d20626c55af19c9abe4d1c7a07d5a058dde29907fe65fbcd1a0e133c4cd151948b47d986b93c3572b04098c5da3435c27a9c847c7d5f990bc9ea0f3d3855ffbcc3c26adbeb526fae48536f4dbc39b9bf24f7a17b76335f6b000eea0c7a4d3135faba63cd89f64b0fabf4d726f0543fa347e8cf44db30bfe6ea9e11da0c2e15f8f776d1e3d9cfd29ef9b1e1c5ee5d6334152f587d72ecb9eed5fc3193ea0481f3b80d234d30cd1294075e557549e908d8152903e7f65382a68fd4aa1c683a0a9ba4206ef4055b28d1126bd21afd4ab26898267d7334191a6cc7f8b07a54122a0715b72d6ed83a6da4e9d376f86690caf329adbc5dcda4cfd0839e3f02066e20a80',
      '0xf90211a00cad8552ddac3a1aa1c598c4d43a80d5a6cac7e58b543c86d5920a78d5b0f0dea0aa5f5aa9836447977b447ef698df483b8e458106b3e64a87005300bf2008562ea0c5925754c6c72a7b07512ee07acdae077ee70e9d3ab04065360fdc4bebdb155fa045f1e4df1025988aa9d0ce23c03f4b366a99286de59d82f1eafdf9a3890905a3a07c86218196a9dea70252b56ee769c10514bbdf33aebcd41fc4392af63febd239a08e202445f7c2fa69da1f1492a1b0e46d8b66b0b7024c7cff23ed5c07191da66fa0b3c179e3f3b9b216e4b35174e4e4d119526af446fdf757ad95e02e49cac28565a0fd74d0a8922342560f6dd820cfa373ec7353c6c66d74bd43351ebb7d103d5ceaa04a8689c3cb5396ee5a99469957f1f0670b0024b2ea3b75e0455797a5175c72a3a085270faec5854bff806bb9951261092745f657e062ae1499d3c5fde81fe14713a07dd8daf759fa359c36c7afc9f7963a557088f5483a8c5d7a0866237fb5f055c5a0d3ec4525a4f0d209a566b07f46a91c609b9c7acbc427db1390485cf4b5105557a005983a192b1f780b095661d92ef4d4102ffd03aad9adb6f3084ba26a11cd0daaa0afd710661f91421da1ece5ea87acc4f76e8af3dad5fa14f0a4ba1ac1a7276449a0ba0374b7981b92f55525b830723b32dce4ebd3c6a13fd06f61b465728ca077c7a0349075b6ff5265073d6ec6676f9b82991159e0bd8170596bcd80573f95576b7380',
      '0xf90131a000e3833f5535c6eae67533a61520c8a99ec1d617d8230498ea57aaac1080ebf880a0432d16911e0f89bb5b6faff16255b203ee2e80db68098f75aee4673d327346b680a04911cdce5361377651739ba44d7f0dcb98e7d22c18f51c955480fcfb5e59abd580a09dec563e0a5682d43213c9a511e954705231ebaee0c72f0aa4f95792823ca0e280a01560fe4a9d9af402122701cccc9d3a13f77747b965d5efe09d0dfce95f807dcca08b5cd207548549e40fd1658e38b5b4227f7f03d8dd112541461c50f3c3ff38a180a0fbf6596703d7037eb2cc332d54fdfcda8e95c23e7478cfe31f6c1da43e7222f78080a0a67c5dda3bd39b79b00911abebf9c976950393b186cb5377ea09536dc48a1ff7a016a9123689ca894c201645726ead95406839cf2f8004461c0bd529321165857180',
      '0xf851808080808080808080a0600efc8e5996c533afd640c3448c198e1101fa32e5bd246f71dd99c7201575308080808080a0a489e21458e112f8f8336e3e90ce8668b0a07bfe7921696a3f0feb657d05a50a80',
      '0xf8669d2004b4599193722f03c0e529c8aab049a7fe5ed19ea9c3fed8c9365470b846f8440180a0384c27b2da88cde93261056c98ced4e09bba7ba17ecbd2c37e9c2cf26f836a22a0db307489fd9a4a438b5b48909e12020b209280ad777561c0a7451655db097e75',
    ],
    address: '0xadca0dd4729c8ba3acf3e99f3a9f471ef37b6825',
    balance: '0x0',
    codeHash: '0xdb307489fd9a4a438b5b48909e12020b209280ad777561c0a7451655db097e75',
    nonce: '0x1',
    storageHash: '0x384c27b2da88cde93261056c98ced4e09bba7ba17ecbd2c37e9c2cf26f836a22',
    storageProof: [
      {
        key: '0x2757396e3ce68a9104b5d84b5b0988e37067e780df1ad018184da3616033f432',
        proof: [
          '0xf90211a0a718fd4452e43b9e3d1e25974976f536a603dde7c12e51d8189b4e3ea6c8dd6aa0a71f668d3dba2a9f242174738ff3596c68a84eb9088fffb307f48e061fbdc667a0a89dbcb1109a64587fdcde7b4268af231c5f0d27e1b25062c6c0bf7b48124d67a0bedf16b76516325a66ac35545179a8dd15ee1c6cd11b2e4357d533b19acb4b26a08b9b03cc165363ebc8f9f0590e76f98fc8502810e4ea87700f41f75a7f6692d8a037444b4dc0ef44f017449fe3b9ce45d9193edbf5c88b6e7bc22884424bf10373a0ff5c4bbed0973d8a097d7d8aa9d4534945aeb03a5785ada86b3a0ae079318894a0711fe60589286b4c83daf48cfba53e3242360c18b59ff7d93c72ffc766ed0428a08ae789ec3e7cce80fafd53e3f0c36744e15d1b0f293f93f691e451faa76b9327a0ca40f7477aca5208d28a6f9a00e6f6ad4fc49ebf83f9344443f004ba2d26a8aaa0958fd01948214784c18bdca21ef8419f04e108ea09f06eaea285f64812b98bada0458b092fc9ba5453463ca558487c118d5f0493aa98c1eb8306722c6fdabc2c7fa02c7c57f079bd040ff813a0a74ac9e46beadd2960eb33a6cd311c6aef4514592da0c785693d9760e93b431bf4b1d5933373a2ef1fe20599a38f3ce7c9643c2e9f23a0bdbe251449087722a740e7bdc0801bf55f3849e23e63d9dda2a8409d5163cd01a03dcac75caeb76acf717184167b6b490a6b96b2f0024daaf13dd8390b5a7c1baf80',
          '0xf90211a0ff5fdab83f7d1d54dfb1fecdd0eb714225aa2533e5e999836c77588671815475a0ee2f0d24e448f85fc8520cf2d98035b2263a8af1db5b837f3fca3124b7b91f48a0787350c2fece0e0b614a68bfb83c20526d19142641b0588005eafb5678599f9ca09fa4124da658c059955c51944334a7891d0c8805f114d0a857079e920cbe6f6ca0b19f68062d189e03ae068799e351f9e1a5927c567067563ccff2f597b8dfd45da05457b729e133026647b6d98180bbbc56076f454fb291879a0c16b22da2a335c5a072031df309f78657aee2acb7b43a486effb4ecd68707d8a438c113bfaf6f1913a0dc0fba7acc1c0a48fc5c978af68fb20c9acaafc7c7515040b1448f324da6050aa0295ff43c4950ab5dee47b2f9e8a04d6a80180643e96488b152ddbd71e25c3b45a0b435feea8e8a46b90fc0156339bce6a210a314694925976b5c82892e1befaaada087dbef5907ae3f99cbe9de597444d7cd15388ccbe88c1b36406f1dad4b0e10eca0f2f0da32846e51736baa70f8bb7922b9fe74002df69ae9d6af48115264b959e9a0462ec92782e4c8f04061daa351713be998149398a2934b4c816b2b9c54e7968da069d20640c46c43d8c5feb541fb0327481d985b623e4f91bea6109d66f486798ea0104e278ae371a220a0d56a72e70ee9657e333baae96329cc862d96eab978804fa06ad2bac3206493db0c51b790f25ecb10ac634112c188c12f5e65496fc14061d180',
          '0xf901f1a01bce8a1cac817f9bd318953b01214d46d0c2ffcffe3f22c81901d9fb8aa55009a0b4880ebbfa94b50526e3de8b46ac96ea60dda4f4edcb1e0316b0299a5d30b04ca0e0d4603a3cd66de5abbe1bb435ed7c317b9edfdad08a0afe84eba49b9fcf088da0c78be3a18158fcef5f88ecd1044da21d03b37d91b906f1abf1ae4cc753088122a008bb32eda0081f564b3426a9ffdd06d9e2856b498b47315622058f176626ed1280a05f6af6349189ad63f9a3af757da563c33e42ffffe1f69a9d4855957920c583fca09c3789f507808280b4a7c4e6234d6582337a2aae5d394111efb07e55e3c1c448a0b7234c0127f2d87aa64f17f09d7d1d72f5701d5410459309da5d15979b6c8c9aa066aabcac035cc9a5fd651bd52328a36a37d4762a6491eb2808af5267acb3f775a0b2d7d676b32bcfd5e8df9cd7f95a9bb91eac071a5b881d9fbc4d9cee0fafedf6a0102c6f1a447995d714d64ab2729b4261df1226374c2f4844f29b2edc69a8b46ca0d03a7b0103fbcba49b8573b566d50d117b00b2c69c048148ef8795fa0a63c7efa0cf6ad8ab9618d75f6d00f49e7b496c77f4591869bc2d0a3ff65d503b2383cfa9a06488cd46027de9ede4d7a7e10327e673234273533310addef6dc3a969aad0bdea0225875ae810220c85166fe921555be9efacceae0aa4654e9fdc2df25cbd1642380',
          '0xf891a01cc2e5507a5150448fe06d254adc104702198a9f8eb5afb15567e80282229e2f80808080808080a04ad7cdbaba63f4b3b9c397858d06888424b7a9aa49d59f9c24fe54211b11d1e68080a09af52c684dd75b985f4aed07ea00ca7ac18201d717064f657fb86f9427aded33808080a03e61dcabfaf134b2b84b92607a7d7abf5b7950f05129a63e77c1d97d7c5e411580',
          '0xeb9f20cb3e0c7eaed59eb82ba9e6f55fbf77c28472e242e7bfa15f1e2c3305ef528a8901523b25a875df6c79',
        ],
        value: '0x1523b25a875df6c79',
      },
    ],
  },
}

// Data for the block we used to get the mainnet subgraph proof.
// This was obtained using eth_getBlockByNumber, and we only kept
// the fields we needed to reconstruct the block header.
const mainnetSubgraphBlockData = {
  parentHash: '0x402376f31f89f631e5372b7f6522bc8465fa0e5eebf2eae46b8a7725c685cbd9',
  sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
  miner: '0x95222290dd7278aa3ddd389cc1e1d165cc4bafe5',
  stateRoot: '0x9d63f5e0289258a0566eaf260c79f152c1ddd624735f2698d9eac5106cfe7852',
  transactionsRoot: '0x5d3fca3e5a32dfc190dce3412479e4f3ece7492d103e9eb80b74f3decfda2aa8',
  receiptsRoot: '0x0bad122ad39e4b2affe59b70ac5e2062533d3ce61c7f2c077cdebb18d8dafbba',
  logsBloom:
    '0x3c247501c104808992481280850305232000084104000910020156c4d46009405409158e041824160e04180070010504020881580acc3c200300408001f01011400681100609042e28020188c030447204c46005204a4a2860c0c528b20030009e4a0880128ac0e1150564802c00aad000006308001906204200001000282008404585438303310385cc8780011840c61024008101009f4c832300406818c00c9a18414a000070430a0160b10940612c00c0020180132003c02f0242a0198000230aba568001a250920c19000c6310010e2702501086401840285917098160395239221c0c0288620001f140010588800310512110ec04c14004e840c88271d2',
  difficulty: '0x0',
  number: '0xf2626a',
  gasLimit: '0x1c9c380',
  gasUsed: '0x6ae2b2',
  timestamp: '0x6362dbc3',
  extraData: '0x6265617665726275696c642e6f7267',
  mixHash: '0x1751b7bb3547c7f27cc383bd35dcbf06a24f9a7629a3c963f75029828fe0c67e',
  nonce: '0x0000000000000000',
}

describe('L2GNS', () => {
  let me: Account
  let other: Account
  let governor: Account
  let tokenSender: Account
  let l1Receiver: Account
  let l2Receiver: Account
  let mockRouter: Account
  let mockL1GRT: Account
  let mockL1Gateway: Account
  let mockL1GNS: Account
  let pauseGuardian: Account
  let fixture: NetworkFixture

  let fixtureContracts: L2FixtureContracts
  let l2GraphTokenGateway: L2GraphTokenGateway
  let gns: L2GNS
  let curation: Curation
  let grt: GraphToken

  let newSubgraph0: PublishSubgraph

  const gatewayFinalizeTransfer = async function (
    from: string,
    to: string,
    amount: BigNumber,
    callhookData: string,
  ): Promise<ContractTransaction> {
    const mockL1GatewayL2Alias = await getL2SignerFromL1(mockL1Gateway.address)
    // Eth for gas:
    await me.signer.sendTransaction({
      to: await mockL1GatewayL2Alias.getAddress(),
      value: parseUnits('1', 'ether'),
    })
    const tx = l2GraphTokenGateway
      .connect(mockL1GatewayL2Alias)
      .finalizeInboundTransfer(mockL1GRT.address, from, to, amount, callhookData)
    return tx
  }

  const defaultL1SubgraphParams = async function (): Promise<L1SubgraphParams> {
    return {
      l1SubgraphId: await buildSubgraphID(me.address, toBN('1'), 1),
      curatedTokens: toGRT('1337'),
      lockBlockhash: randomHexBytes(32),
      metadata: randomHexBytes(),
      nSignal: toBN('4567'),
    }
  }
  const migrateMockSubgraphFromL1 = async function (
    l1SubgraphId: string,
    curatedTokens: BigNumber,
    lockBlockhash: string,
    metadata: string,
    nSignal: BigNumber,
  ) {
    const callhookData = defaultAbiCoder.encode(
      ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
      [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
    )
    await gatewayFinalizeTransfer(mockL1GNS.address, gns.address, curatedTokens, callhookData)

    await gns
      .connect(me.signer)
      .finishSubgraphMigrationFromL1(l1SubgraphId, newSubgraph0.subgraphDeploymentID, metadata)
  }

  before(async function () {
    newSubgraph0 = buildSubgraph()
    ;[
      me,
      other,
      governor,
      tokenSender,
      l1Receiver,
      mockRouter,
      mockL1GRT,
      mockL1Gateway,
      l2Receiver,
      pauseGuardian,
      mockL1GNS,
    ] = await getAccounts()

    fixture = new NetworkFixture()
    fixtureContracts = await fixture.loadL2(governor.signer)
    ;({ l2GraphTokenGateway, gns, curation, grt } = fixtureContracts)

    await grt.connect(governor.signer).mint(me.address, toGRT('10000'))
    await fixture.configureL2Bridge(
      governor.signer,
      fixtureContracts,
      mockRouter.address,
      mockL1GRT.address,
      mockL1Gateway.address,
      mockL1GNS.address,
    )
  })

  beforeEach(async function () {
    await fixture.setUp()
  })

  afterEach(async function () {
    await fixture.tearDown()
  })

  describe('receiving a subgraph from L1 (onTokenTransfer)', function () {
    it('cannot be called by someone other than the L2GraphTokenGateway', async function () {
      const { l1SubgraphId, curatedTokens, lockBlockhash, metadata, nSignal } =
        await defaultL1SubgraphParams()
      const callhookData = defaultAbiCoder.encode(
        ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
        [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
      )
      const tx = gns
        .connect(me.signer)
        .onTokenTransfer(mockL1GNS.address, curatedTokens, callhookData)
      await expect(tx).revertedWith('ONLY_GATEWAY')
    })
    it('rejects calls if the L1 sender is not the L1GNS', async function () {
      const { l1SubgraphId, curatedTokens, lockBlockhash, metadata, nSignal } =
        await defaultL1SubgraphParams()
      const callhookData = defaultAbiCoder.encode(
        ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
        [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
      )
      const tx = gatewayFinalizeTransfer(me.address, gns.address, curatedTokens, callhookData)

      await expect(tx).revertedWith('ONLY_L1_GNS_THROUGH_BRIDGE')
    })
    it('creates a subgraph in a disabled state', async function () {
      const l1SubgraphId = await buildSubgraphID(me.address, toBN('1'), 1)
      const curatedTokens = toGRT('1337')
      const lockBlockhash = randomHexBytes(32)
      const metadata = randomHexBytes()
      const nSignal = toBN('4567')
      const callhookData = defaultAbiCoder.encode(
        ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
        [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
      )
      const tx = gatewayFinalizeTransfer(
        mockL1GNS.address,
        gns.address,
        curatedTokens,
        callhookData,
      )

      await expect(tx)
        .emit(l2GraphTokenGateway, 'DepositFinalized')
        .withArgs(mockL1GRT.address, mockL1GNS.address, gns.address, curatedTokens)
      await expect(tx).emit(gns, 'SubgraphReceivedFromL1').withArgs(l1SubgraphId)
      await expect(tx).emit(gns, 'SubgraphMetadataUpdated').withArgs(l1SubgraphId, metadata)

      const migrationData = await gns.subgraphL2MigrationData(l1SubgraphId)
      const subgraphData = await gns.subgraphs(l1SubgraphId)

      expect(migrationData.lockedAtBlock).eq(0) // We don't use this in L2
      expect(migrationData.tokens).eq(curatedTokens)
      expect(migrationData.lockedAtBlockHash).eq(lockBlockhash)
      expect(migrationData.l1Done).eq(true) // We don't use this in L2
      expect(migrationData.l2Done).eq(false)
      expect(migrationData.deprecated).eq(false) // We don't use this in L2

      expect(subgraphData.vSignal).eq(0)
      expect(subgraphData.nSignal).eq(nSignal)
      expect(subgraphData.subgraphDeploymentID).eq(HashZero)
      expect(subgraphData.reserveRatio).eq(DEFAULT_RESERVE_RATIO)
      expect(subgraphData.disabled).eq(true)
      expect(subgraphData.withdrawableGRT).eq(0) // Important so that it's not the same as a deprecated subgraph!

      expect(await gns.ownerOf(l1SubgraphId)).eq(me.address)
    })
    it('does not conflict with a locally created subgraph', async function () {
      const l2Subgraph = await publishNewSubgraph(me, newSubgraph0, gns)

      const l1SubgraphId = await buildSubgraphID(me.address, toBN('0'), 1)
      const curatedTokens = toGRT('1337')
      const lockBlockhash = randomHexBytes(32)
      const metadata = randomHexBytes()
      const nSignal = toBN('4567')
      const callhookData = defaultAbiCoder.encode(
        ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
        [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
      )
      const tx = gatewayFinalizeTransfer(
        mockL1GNS.address,
        gns.address,
        curatedTokens,
        callhookData,
      )

      await expect(tx)
        .emit(l2GraphTokenGateway, 'DepositFinalized')
        .withArgs(mockL1GRT.address, mockL1GNS.address, gns.address, curatedTokens)
      await expect(tx).emit(gns, 'SubgraphReceivedFromL1').withArgs(l1SubgraphId)
      await expect(tx).emit(gns, 'SubgraphMetadataUpdated').withArgs(l1SubgraphId, metadata)

      const migrationData = await gns.subgraphL2MigrationData(l1SubgraphId)
      const subgraphData = await gns.subgraphs(l1SubgraphId)

      expect(migrationData.lockedAtBlock).eq(0) // We don't use this in L2
      expect(migrationData.tokens).eq(curatedTokens)
      expect(migrationData.lockedAtBlockHash).eq(lockBlockhash)
      expect(migrationData.l1Done).eq(true) // We don't use this in L2
      expect(migrationData.l2Done).eq(false)
      expect(migrationData.deprecated).eq(false) // We don't use this in L2

      expect(subgraphData.vSignal).eq(0)
      expect(subgraphData.nSignal).eq(nSignal)
      expect(subgraphData.subgraphDeploymentID).eq(HashZero)
      expect(subgraphData.reserveRatio).eq(DEFAULT_RESERVE_RATIO)
      expect(subgraphData.disabled).eq(true)
      expect(subgraphData.withdrawableGRT).eq(0) // Important so that it's not the same as a deprecated subgraph!

      expect(await gns.ownerOf(l1SubgraphId)).eq(me.address)

      expect(l2Subgraph.id).not.eq(l1SubgraphId)
      const l2SubgraphData = await gns.subgraphs(l2Subgraph.id)
      expect(l2SubgraphData.vSignal).eq(0)
      expect(l2SubgraphData.nSignal).eq(0)
      expect(l2SubgraphData.subgraphDeploymentID).eq(l2Subgraph.subgraphDeploymentID)
      expect(l2SubgraphData.reserveRatio).eq(DEFAULT_RESERVE_RATIO)
      expect(l2SubgraphData.disabled).eq(false)
      expect(l2SubgraphData.withdrawableGRT).eq(0)
    })
  })

  describe('finishing a subgraph migration from L1', function () {
    it('publishes the migrated subgraph and mints signal with no tax', async function () {
      const { l1SubgraphId, curatedTokens, lockBlockhash, metadata, nSignal } =
        await defaultL1SubgraphParams()
      const callhookData = defaultAbiCoder.encode(
        ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
        [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
      )
      await gatewayFinalizeTransfer(mockL1GNS.address, gns.address, curatedTokens, callhookData)
      // Calculate expected signal before minting, which changes the price
      const expectedSignal = await curation.tokensToSignalNoTax(
        newSubgraph0.subgraphDeploymentID,
        curatedTokens,
      )

      const tx = gns
        .connect(me.signer)
        .finishSubgraphMigrationFromL1(l1SubgraphId, newSubgraph0.subgraphDeploymentID, metadata)
      await expect(tx)
        .emit(gns, 'SubgraphPublished')
        .withArgs(l1SubgraphId, newSubgraph0.subgraphDeploymentID, DEFAULT_RESERVE_RATIO)

      const subgraphAfter = await gns.subgraphs(l1SubgraphId)
      const migrationDataAfter = await gns.subgraphL2MigrationData(l1SubgraphId)
      expect(subgraphAfter.vSignal).eq(expectedSignal)
      expect(migrationDataAfter.l2Done).eq(true)
      expect(migrationDataAfter.deprecated).eq(false)
      expect(subgraphAfter.subgraphDeploymentID).eq(newSubgraph0.subgraphDeploymentID)
    })
    it('cannot be called by someone other than the subgraph owner', async function () {
      const { l1SubgraphId, curatedTokens, lockBlockhash, metadata, nSignal } =
        await defaultL1SubgraphParams()
      const callhookData = defaultAbiCoder.encode(
        ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
        [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
      )
      await gatewayFinalizeTransfer(mockL1GNS.address, gns.address, curatedTokens, callhookData)

      const tx = gns
        .connect(other.signer)
        .finishSubgraphMigrationFromL1(l1SubgraphId, newSubgraph0.subgraphDeploymentID, metadata)
      await expect(tx).revertedWith('GNS: Must be authorized')
    })
    it('rejects calls for a subgraph that does not exist', async function () {
      const l1SubgraphId = await buildSubgraphID(me.address, toBN('1'), 1)
      const metadata = randomHexBytes()

      const tx = gns
        .connect(me.signer)
        .finishSubgraphMigrationFromL1(l1SubgraphId, newSubgraph0.subgraphDeploymentID, metadata)
      await expect(tx).revertedWith('ERC721: owner query for nonexistent token')
    })
    it('rejects calls for a subgraph that was not migrated', async function () {
      const l2Subgraph = await publishNewSubgraph(me, newSubgraph0, gns)
      const metadata = randomHexBytes()

      const tx = gns
        .connect(me.signer)
        .finishSubgraphMigrationFromL1(l2Subgraph.id, newSubgraph0.subgraphDeploymentID, metadata)
      await expect(tx).revertedWith('INVALID_SUBGRAPH')
    })
    it('rejects calls to a pre-curated subgraph deployment', async function () {
      const { l1SubgraphId, curatedTokens, lockBlockhash, metadata, nSignal } =
        await defaultL1SubgraphParams()
      const callhookData = defaultAbiCoder.encode(
        ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
        [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
      )
      await gatewayFinalizeTransfer(mockL1GNS.address, gns.address, curatedTokens, callhookData)

      await grt.connect(me.signer).approve(curation.address, toGRT('100'))
      await curation
        .connect(me.signer)
        .mint(newSubgraph0.subgraphDeploymentID, toGRT('100'), toBN('0'))
      const tx = gns
        .connect(me.signer)
        .finishSubgraphMigrationFromL1(l1SubgraphId, newSubgraph0.subgraphDeploymentID, metadata)
      await expect(tx).revertedWith('GNS: Deployment pre-curated')
    })
    it('rejects calls if the subgraph deployment ID is zero', async function () {
      const l1SubgraphId = await buildSubgraphID(me.address, toBN('1'), 1)
      const curatedTokens = toGRT('1337')
      const lockBlockhash = randomHexBytes(32)
      const metadata = randomHexBytes()
      const nSignal = toBN('4567')
      const callhookData = defaultAbiCoder.encode(
        ['uint256', 'address', 'bytes32', 'uint256', 'uint32', 'bytes32'],
        [l1SubgraphId, me.address, lockBlockhash, nSignal, DEFAULT_RESERVE_RATIO, metadata],
      )
      await gatewayFinalizeTransfer(mockL1GNS.address, gns.address, curatedTokens, callhookData)

      const tx = gns
        .connect(me.signer)
        .finishSubgraphMigrationFromL1(l1SubgraphId, HashZero, metadata)
      await expect(tx).revertedWith('GNS: deploymentID != 0')
    })
  })

  describe('claiming a curator balance using a proof', function () {
    it('verifies a proof and assigns a curator balance (WIP)', async function () {
      const l1Subgraph = mainnetSubgraphWithProof

      // Now we pretend the L1 subgraph was locked and migrated at the specified block
      await migrateMockSubgraphFromL1(
        l1Subgraph.subgraphId,
        l1Subgraph.curatedTokens,
        l1Subgraph.blockhash,
        l1Subgraph.metadata,
        l1Subgraph.nSignal,
      )

      // We need L2GNS to think the mainnet GNS is its counterpart for the proof to be valid
      await gns
        .connect(governor.signer)
        .setCounterpartGNSAddress(l1Subgraph.getProofResponse.address)

      // TODO:
      // We need to construct the block header RLP
      // Then we encode the proof into an RLP list as well
      // And finally we verify the proof
    })
    it('adds the balance to any existing balance for the curator')
    it('rejects calls with an invalid proof')
    it('rejects calls for a subgraph that was not migrated')
    it('rejects calls if the balance was already claimed')
    it('rejects calls with proof from a different curator')
    it('rejects calls with proof from a different contract')
    it('rejects calls with a proof from a different block')
  })
  describe('claiming a curator balance with a message from L1', function () {
    it('assigns a curator balance to a beneficiary')
    it('adds the balance to any existing balance for the beneficiary')
    it('can only be called from the gateway')
    it('rejects calls for a subgraph that was not migrated')
    it('rejects calls if the balance was already claimed')
  })
})
