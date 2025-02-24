import { MasterNodeKey, RegTestFoundationKeys } from '@defichain/jellyfish-network'
import { waitForCondition } from '../../utils'
import { DockerOptions } from 'dockerode'
import { DeFiDContainer, StartOptions } from '../DeFiDContainer'
import { RegTestContainer } from './index'

/**
 * RegTest with MasterNode preconfigured
 */
export class MasterNodeRegTestContainer extends RegTestContainer {
  private readonly masternodeKey: MasterNodeKey

  /**
   * @param {string} [masternodeKey=RegTestFoundationKeys[0]] pair to use for minting
   * @param {string} [image=DeFiDContainer.image] docker image name
   * @param {DockerOptions} [options]
   */
  constructor (masternodeKey: MasterNodeKey = RegTestFoundationKeys[0], image: string = DeFiDContainer.image, options?: DockerOptions) {
    super(image, options)
    this.masternodeKey = masternodeKey
  }

  /**
   * Additional debug options turned on for traceability.
   */
  protected getCmd (opts: StartOptions): string[] {
    return [
      ...super.getCmd(opts),
      '-dummypos=0',
      '-spv=1',
      '-anchorquorum=2',
      `-masternode_operator=${this.masternodeKey.operator.address}`
    ]
  }

  /**
   * @param {number} nblocks to generate
   * @param {string} address to generate to
   * @param {number} maxTries
   */
  async generate (nblocks: number, address: string = this.masternodeKey.operator.address, maxTries: number = 1000000): Promise<void> {
    for (let minted = 0, tries = 0; minted < nblocks && tries < maxTries; tries++) {
      const result = await this.call('generatetoaddress', [1, address, 1])

      if (result === 1) {
        minted += 1
      }
    }
  }

  /**
   * @param {number} nblocks to generate
   * @param {number} timeout
   * @param {string} address
   */
  async waitForGenerate (nblocks: number, timeout: number = 590000, address: string = this.masternodeKey.operator.address): Promise<void> {
    const target = await this.getBlockCount() + nblocks

    return await waitForCondition(async () => {
      const count = await this.getBlockCount()
      if (count > target) {
        return true
      }
      await this.generate(1)
      return false
    }, timeout, 100, 'waitForGenerate')
  }

  /**
   * This will automatically import the necessary private key for master to mint tokens
   */
  async start (startOptions: StartOptions = {}): Promise<void> {
    await super.start(startOptions)

    await this.call('importprivkey', [this.masternodeKey.operator.privKey, 'operator', true])
    await this.call('importprivkey', [this.masternodeKey.owner.privKey, 'owner', true])
  }

  /**
   * Wait for block height by minting towards the target
   *
   * @param {number} height to wait for
   * @param {number} [timeout=590000] in ms
   */
  async waitForBlockHeight (height: number, timeout = 590000): Promise<void> {
    return await waitForCondition(async () => {
      const count = await this.getBlockCount()
      if (count > height) {
        return true
      }
      await this.generate(1)
      return false
    }, timeout, 100, 'waitForBlockHeight')
  }

  /**
   * Wait for master node wallet coin to be mature for spending.
   *
   * A coinbase transaction must be 100 blocks deep before you can spend its outputs. This is a
   * safeguard to prevent outputs that originate from the coinbase transaction from becoming
   * un-spendable (in the event the mined block moves out of the active chain due to a fork).
   *
   * @param {number} [timeout=180000] in ms
   * @param {boolean} [mockTime=true] to generate blocks faster
   */
  async waitForWalletCoinbaseMaturity (timeout: number = 180000, mockTime: boolean = true): Promise<void> {
    if (!mockTime) {
      return await this.waitForBlockHeight(100, timeout)
    }

    let fakeTime: number = 1579045065
    await this.call('setmocktime', [fakeTime])

    const intervalId = setInterval(() => {
      fakeTime += 3
      void this.call('setmocktime', [fakeTime])
    }, 200)

    await this.waitForBlockHeight(100, timeout)

    clearInterval(intervalId)
    await this.call('setmocktime', [0])
  }

  /**
   * Wait for in wallet balance to be greater than an amount.
   * This allow test that require fund to wait for fund to be filled up before running the tests.
   * This method will trigger block generate to get to the required balance faster.
   * Set `timeout` to higher accordingly when large balance required.
   *
   * @param {number} balance to wait for in wallet to be greater than or equal
   * @param {number} [timeout=300000] in ms
   * @see waitForWalletCoinbaseMaturity
   */
  async waitForWalletBalanceGTE (balance: number, timeout = 300000): Promise<void> {
    return await waitForCondition(async () => {
      const getbalance = await this.call('getbalance')
      if (getbalance >= balance) {
        return true
      }
      await this.generate(1)
      return false
    }, timeout, 100, 'waitForWalletBalanceGTE')
  }

  /**
   * Wait for anchor teams
   *
   * @param {number} nodesLength
   * @param {number} [timeout=30000] in ms
   * @return {Promise<void>}
   */

  /* istanbul ignore next, TODO(canonbrother) */
  async waitForAnchorTeams (nodesLength: number, timeout = 30000): Promise<void> {
    return await waitForCondition(async () => {
      const anchorTeams = await this.call('getanchorteams')
      if (anchorTeams.auth.length === nodesLength && anchorTeams.confirm.length === nodesLength) {
        return true
      }
      return false
    }, timeout, 100, 'waitForAnchorTeams')
  }

  /**
   * Wait for anchor auths
   *
   * @param {number} nodesLength
   * @param {number} [timeout=30000] in ms
   * @return {Promise<void>}
   */

  /* istanbul ignore next, TODO(canonbrother) */
  async waitForAnchorAuths (nodesLength: number, timeout = 30000): Promise<void> {
    return await waitForCondition(async () => {
      const auths = await this.call('spv_listanchorauths')
      if (auths.length > 0 && auths[0].signers === nodesLength) {
        return true
      }
      return false
    }, timeout, 100, 'waitForAnchorAuths')
  }

  /**
   * Wait for anchor reward confirms
   *
   * @param {number} [timeout=30000] in ms
   * @return {Promise<void>}
   */
  async waitForAnchorRewardConfirms (timeout = 30000): Promise<void> {
    // extra info here
    // max signers in regtest is 3, others are 5
    // majority is defined as 66% above
    const majority = 2
    return await waitForCondition(async () => {
      const confirms = await this.call('spv_listanchorrewardconfirms')
      if (confirms.length === 1 && confirms[0].signers >= majority) {
        return true
      }
      return false
    }, timeout, 100, 'waitForAnchorRewardConfrims')
  }

  /**
   * Wait for price become valid
   *
   * @param {string} fixedIntervalPriceId
   * @param {number} [timeout=30000] in ms
   * @return {Promise<void>}
   */
  async waitForPriceValid (fixedIntervalPriceId: string, timeout = 30000): Promise<void> {
    return await waitForCondition(async () => {
      const data: any = await this.call('getfixedintervalprice', [fixedIntervalPriceId])
      // eslint-disable-next-line
      if (!data.isLive) {
        await this.generate(1)
        return false
      }
      return true
    }, timeout, 100, 'waitForPriceValid')
  }

  /**
   * Wait for price become invalid
   *
   * @param {string} fixedIntervalPriceId
   * @param {number} [timeout=30000] in ms
   * @return {Promise<void>}
   */
  async waitForPriceInvalid (fixedIntervalPriceId: string, timeout = 30000): Promise<void> {
    return await waitForCondition(async () => {
      const data: any = await this.call('getfixedintervalprice', [fixedIntervalPriceId])
      // eslint-disable-next-line
      if (data.isLive) {
        await this.generate(1)
        return false
      }
      return true
    }, timeout, 100, 'waitForPriceInvalid')
  }

  /**
   * Wait for valut state
   *
   * @param {string} vaultId
   * @param {string} state
   * @param {number} [timeout=30000] in ms
   * @return {Promise<void>}
   */
  async waitForVaultState (vaultId: string, state: string, timeout = 30000): Promise<void> {
    return await waitForCondition(async () => {
      const vault = await this.call('getvault', [vaultId])
      if (vault.state !== state) {
        await this.generate(1)
        return false
      }
      return true
    }, timeout, 100, 'waitForVaultState')
  }

  /**
   * Get next price block before the given target block
   *
   * @param {string} fixedIntervalPriceId
   * @param {number} [targetBlock]
   * @return {Promise<number>}
   */
  async getImmediatePriceBlockBeforeBlock (fixedIntervalPriceId: string, targetBlock: number): Promise<number> {
    const data: any = await this.call('getfixedintervalprice', [fixedIntervalPriceId])
    let nextPriceBlock = data.nextPriceBlock as number
    while (nextPriceBlock < targetBlock) {
      nextPriceBlock += 6 // 1 hour in regtest is 6 blocks
    }
    return nextPriceBlock
  }

  /**
   * Wait for active price
   *
   * @param {string} fixedIntervalPriceId
   * @param {string} activePrice
   * @param {number} [timeout=30000] in ms
   * @return {Promise<void>}
   */
  async waitForActivePrice (fixedIntervalPriceId: string, activePrice: string, timeout = 30000): Promise<void> {
    return await waitForCondition(async () => {
      const data: any = await this.call('getfixedintervalprice', [fixedIntervalPriceId])
      // eslint-disable-next-line
      if (data.activePrice.toString() !== activePrice) {
        await this.generate(1)
        return false
      }
      return true
    }, timeout, 100, 'waitForActivePrice')
  }

  /**
   * Wait for next price
   *
   * @param {string} fixedIntervalPriceId
   * @param {string} nextPrice
   * @param {number} [timeout=30000] in ms
   * @return {Promise<void>}
   */
  async waitForNextPrice (fixedIntervalPriceId: string, nextPrice: string, timeout = 30000): Promise<void> {
    return await waitForCondition(async () => {
      const data: any = await this.call('getfixedintervalprice', [fixedIntervalPriceId])
      // eslint-disable-next-line
      if (data.nextPrice.toString() !== nextPrice) {
        await this.generate(1)
        return false
      }
      return true
    }, timeout, 100, 'waitForNextPrice')
  }

  /**
   * Fund an address with an amount and wait for 1 confirmation.
   * Funded address don't have to be tracked within the node wallet.
   * This allows for light wallet implementation testing.
   *
   * @param {string} address to fund
   * @param {number} amount to fund an address, take note of number precision issues, BigNumber not included in pkg.
   * @return {Promise<{txid: string, vout: number}>} txid and index of the transaction
   * @see waitForWalletCoinbaseMaturity
   * @see waitForWalletBalanceGTE
   */
  async fundAddress (address: string, amount: number): Promise<{ txid: string, vout: number }> {
    const txid = await this.call('sendtoaddress', [address, amount])
    await this.generate(1)

    const { vout }: {
      vout: Array<{
        n: number
        scriptPubKey: {
          addresses: string[]
        }
      }>
    } = await this.call('getrawtransaction', [txid, true])
    for (const out of vout) {
      if (out.scriptPubKey.addresses.includes(address)) {
        return {
          txid,
          vout: out.n
        }
      }
    }

    throw new Error('getrawtransaction will always return the required vout')
  }

  /**
   * Create a new bech32 address and get the associated priv key for it.
   * The address is created in the wallet and the priv key is dumped out.
   * This is to facilitate raw tx feature testing, if you need an address that is not associated with the wallet,
   * use jellyfish-crypto instead.
   *
   * This is not a deterministic feature, each time you run this, you get a different set of address and keys.
   *
   * @return {Promise<{ address: string, privKey: string, pubKey: string }>} a new address and it's associated privKey
   */
  async newAddressKeys (): Promise<{ address: string, privKey: string, pubKey: string }> {
    const address = await this.call('getnewaddress', ['', 'bech32'])
    const privKey = await this.call('dumpprivkey', [address])
    const getaddressinfo = await this.call('getaddressinfo', [address])
    return {
      address,
      privKey,
      pubKey: getaddressinfo.pubkey
    }
  }
}
