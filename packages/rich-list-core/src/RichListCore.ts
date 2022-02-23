import { ApiClient, BigNumber, blockchain as defid } from '@defichain/jellyfish-api-core'
import { QueueClient } from './lib/Queue'
import { PersistentStorage } from './lib/PersistentStorage'
import { AddressParser } from './controller/AddressParser'
import { NetworkName } from '@defichain/jellyfish-network'
import { RichListItem } from '@defichain/rich-list-api-client'
import { AccountAmount } from 'packages/jellyfish-api-core/src/category/account'
import { ActiveAddressAccountAmount } from './controller/AddressParser/ActiveAddressAccountAmount'
import { PersistentLinkedList } from './lib/PersistentLinkedList'

const DEFAULT_RICH_LIST_LENGTH = 1000

export class RichListCore {
  isCatchingUp = false
  richListLength = DEFAULT_RICH_LIST_LENGTH
  readonly addressParser: AddressParser

  constructor (
    private readonly network: NetworkName,
    private readonly apiClient: ApiClient,
    private readonly existingRichList: PersistentStorage<number, RichListItem[]>,
    private readonly queueClient: QueueClient<string>,
    private readonly crawledBlocks: PersistentLinkedList<BlockDroppedOutAddresses>
  ) {
    this.addressParser = new AddressParser(apiClient, network)
  }

  setRichListLength (length: number): void {
    this.richListLength = length
  }

  resume (): void {
    if (this.isCatchingUp) {
      return
    }
    this.isCatchingUp = true
    void this._catchUp()
  }

  async _catchUp (): Promise<void> {
    const nextBlockHeight = await this.crawledBlocks.size()
    const nextBlock = await this._getBlock(nextBlockHeight)

    if (nextBlock === undefined) {
      this.isCatchingUp = false
      return
    }

    const lastHashed = await this.crawledBlocks.getLast()
    if (lastHashed !== undefined && lastHashed.hash !== nextBlock.previousblockhash) {
      // TODO(@ivan-zynesis): invalidate()
    } else {
      const queue = await this.queueClient.createQueueIfNotExist(this._queueName(), 'LIFO')

      const addresses: string[] = []
      for (const tx of nextBlock.tx) {
        const _addresses = await this.addressParser.parse(tx)
        for (const a of _addresses) {
          addresses.push(a)
          await queue.push(a)
        }
      }
      await this.crawledBlocks.append({
        hash: nextBlock.hash,
        richListDroppedOut: addresses
      })
    }

    return await this._catchUp()
  }

  private async _getBlock (height: number): Promise<defid.Block<defid.Transaction> | undefined> {
    try {
      const bh = await this.apiClient.blockchain.getBlockHash(height)
      return await this.apiClient.blockchain.getBlock(bh, 2)
    } catch (err: any) {
      if (err.payload.message === 'Block height out of range') {
        return undefined
      }
      throw err
    }
  }

  // private async _invalidate () {
  //   /**
  //    * TODO:
  //    * 1. remove highest block data
  //    * 2. get back dropped address
  //    * 3. sort rich list again
  //    */
  // }

  async get (token: string): Promise<RichListItem[]> {
    if (Number.isNaN(token)) {
      throw new Error('Invalid token id')
    }

    if (!(await this._listTokens()).includes(Number(token))) {
      throw new Error('Invalid token id')
    }

    return await this.existingRichList.get(Number(token)) ?? []
  }

  /**
   * Updated rich list with latest balance
   * by sorting the existing rich list together with `queuedAddressLimit` number of recently active addresses
   *
   * @param queuedAddressLimit [5000]
   */
  async calculateNext (queuedAddressLimit = 5000): Promise<void> {
    const tokens = await this._listTokens()
    let updatedBalances = await this._getActiveAddressBalances(tokens, queuedAddressLimit)

    while (Object.keys(updatedBalances).length > 0) {
      for (const tokenId of tokens) {
        const updated = await this._computeRichList(tokenId, updatedBalances)
        await this.existingRichList.put(tokenId, updated)
      }

      updatedBalances = await this._getActiveAddressBalances(tokens, queuedAddressLimit)
    }
  }

  private async _computeRichList (tokenId: number, activeAddressBalances: ActiveAddressAccountAmount): Promise<RichListItem[]> {
    const latestBalances: RichListItem[] = Object.keys(activeAddressBalances).map(address => ({
      address: address,
      amount: activeAddressBalances[address][tokenId].toNumber()
    }))
    const existing = (await this.existingRichList.get(tokenId)) ?? []
    return existing
      .filter(rl => !latestBalances.map(rl => rl.address).includes(rl.address))
      .concat(latestBalances)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, this.richListLength)
  }

  private async _getActiveAddressBalances (tokens: number[], queuedAddressLimit: number): Promise<ActiveAddressAccountAmount> {
    const queue = await this.queueClient.createQueueIfNotExist(this._queueName(), 'LIFO')
    const addresses = await queue.receive(queuedAddressLimit)

    const balances: { [key: string]: AccountAmount } = {}
    for (const a of addresses) {
      const nonZeroBalances = await this.apiClient.account.getTokenBalances(
        { limit: Number.MAX_SAFE_INTEGER },
        true
      ) as any as AccountAmount
      balances[a] = this._appendZeroBalances(nonZeroBalances, tokens)
    }
    return balances
  }

  private _appendZeroBalances (tokenBalances: AccountAmount, tokens: number[]): AccountAmount {
    const result: AccountAmount = {}
    for (const t of tokens) {
      result[t] = tokenBalances[t] ?? new BigNumber(0)
    }
    return result
  }

  private async _listTokens (): Promise<number[]> {
    const tokens = await this.apiClient.token.listTokens()
    return Object.keys(tokens).map(id => Number(id))
  }

  private _queueName (): string {
    return 'RichListCore_ACTIVE_ADDRESSES'
  }
}

export interface BlockDroppedOutAddresses {
  hash: string
  richListDroppedOut: string[]
}
