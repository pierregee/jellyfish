---
id: masternode
title: Masternode API
sidebar_label: Masternode API
slug: /jellyfish/api/masternode
---

```js
import {JsonRpcClient} from '@defichain/jellyfish-api-jsonrpc'
const client = new JsonRpcClient('http://foo:bar@localhost:8554')

// Using client.masternode.
const something = await client.masternode.method()
```

## createMasternode

Creates a masternode creation transaction with given owner and operator addresses.

```ts title="client.masternode.createMasternode()"
interface masternode {
  createMasternode (
    ownerAddress: string,
    operatorAddress?: string,
    options: CreateMasternodeOptions = { utxos: [] }
  ): Promise<string>
}

interface UTXO {
  txid: string
  vout: number
}

interface CreateMasternodeOptions {
  utxos: UTXO[]
  timelock?: MasternodeTimeLock
}

enum MasternodeTimeLock {
  FIVE_YEAR = 'FIVEYEARTIMELOCK',
  TEN_YEAR = 'TENYEARTIMELOCK'
}
```

## listMasternodes

Returns information about multiple masternodes.

```ts title="client.masternode.listMasternodes()"
interface masternode {
  listMasternodes (pagination?: MasternodePagination, verbose?: boolean): Promise<MasternodeResult<MasternodeInfo>>
  listMasternodes (pagination: MasternodePagination, verbose: true): Promise<MasternodeResult<MasternodeInfo>>
  listMasternodes (pagination: MasternodePagination, verbose: false): Promise<MasternodeResult<string>>
  listMasternodes<T> (
    pagination: MasternodePagination = {
      including_start: true,
      limit: 100
    },
    verbose: boolean = true
  ): Promise<MasternodeResult<T>>
}

enum MasternodeState {
  PRE_ENABLED = 'PRE_ENABLED',
  ENABLED = 'ENABLED',
  PRE_RESIGNED = 'PRE_RESIGNED',
  RESIGNED = 'RESIGNED',
  PRE_BANNED = 'PRE_BANNED',
  BANNED = 'BANNED',
  UNKNOWN = 'UNKNOWN'
}

interface MasternodePagination {
  start?: string
  including_start?: boolean
  limit?: number
}

interface MasternodeInfo {
  ownerAuthAddress: string
  operatorAuthAddress: string
  rewardAddress: string
  creationHeight: number
  resignHeight: number
  resignTx: string
  collateralTx: string
  state: MasternodeState
  mintedBlocks: number
  ownerIsMine: boolean
  operatorIsMine: boolean
  localMasternode: boolean
  targetMultiplier?: number
  targetMultipliers?: number[]
  timelock?: number
}

interface MasternodeResult<T> {
  [id: string]: T
}
```

## getMasternode

Returns information about a single masternode

```ts title="client.masternode.getMasternode()"
interface masternode {
  getMasternode (masternodeId: string): Promise<MasternodeResult<MasternodeInfo>>
}

enum MasternodeState {
  PRE_ENABLED = 'PRE_ENABLED',
  ENABLED = 'ENABLED',
  PRE_RESIGNED = 'PRE_RESIGNED',
  RESIGNED = 'RESIGNED',
  PRE_BANNED = 'PRE_BANNED',
  BANNED = 'BANNED',
  UNKNOWN = 'UNKNOWN'
}

interface MasternodeInfo {
  ownerAuthAddress: string
  operatorAuthAddress: string
  rewardAddress: string
  creationHeight: number
  resignHeight: number
  resignTx: string
  collateralTx: string
  state: MasternodeState
  mintedBlocks: number
  ownerIsMine: boolean
  operatorIsMine: boolean
  localMasternode: boolean
  targetMultiplier?: number
  targetMultipliers?: number[]
  timelock?: number
}

interface MasternodeResult<T> {
  [id: string]: T
}
```

## getMasternodeBlocks

Returns blocks generated by the specified masternode

```ts title="client.masternode.getMasternodeBlocks"
interface masternode {
  getMasternodeBlocks(identifier: MasternodeBlock, depth?: number): Promise<MasternodeResult<string>> 
}

interface MasternodeBlock {
  id?: string
  ownerAddress?: string
  operatorAddress?: string
}
```

## resignMasternode 

Creates a transaction resigning a masternode.

```ts title="client.masternode.resignMasternode()"
interface masternode {
  resignMasternode (masternodeId: string, utxos: UTXO[] = []): Promise<string>
}

interface UTXO {
  txid: string
  vout: number
}
```

## updatemasternode

Creates (and submits to local node and network) a masternode update transaction which update the masternode operator addresses, spending the given inputs..
The last optional argument (may be empty array) is an array of specific UTXOs to spend.

```ts title="client.masternode.updatemasternode()"
interface masternode {
  updateMasternode(masternodeId: string, values: UpdateMasternodeValues, utxos: UTXO[] = []): Promise<string>
}

interface UpdateMasternodeValues {
  ownerAddress?: string
  operatorAddress?: string
  rewardAddress?: string
}
```

## setGov

Set special governance variables

```ts title="client.masternode.setGov()"
interface masternode {
  setGov (input: Record<string, any>): Promise<string>
}
```

## setGovHeight

Set special governance variables with activation height specified

```ts title="client.masternode.setGovHeight()"
interface masternode {
  setGovHeight (input: Record<string, any>, activationHeight: number, utxos: UTXO[] = []): Promise<string>
}
```

## getGov

Get information about governance variable

```ts title="client.masternode.getGov()"
interface masternode {
  getGov (name: string): Promise<Record<string, any>>
}
```

## listGovs

List all governance variables together if any with activation height

```ts title="client.masternode.listGovs()"
interface masternode {
  listGovs (): Promise<Array<Array<Record<string, any>>>>
}
```

## unsetGov

Unset governance variables

```ts title="client.masternode.unsetGov()"
interface masternode {
  unsetGov (variables: Record<string, number | string | string[]>, utxos: UTXO[] = []): Promise<string>
}
```

## isAppliedCustomTransaction

Checks that custom transaction was affected on chain

```ts title="client.masternode.isAppliedCustomTransaction()"
interface masternode {
  isAppliedCustomTransaction (transactionId: string, blockHeight: number): Promise<boolean>
}
```

## getAnchorTeams

Returns the auth and confirm anchor masternode teams at current or specified height

```ts title="client.masternode.getAnchorTeams"
interface masternode {
  getAnchorTeams (blockHeight?: number): Promise<AnchorTeamResult> 
}

interface AnchorTeamResult {
  auth: string[]
  confirm: string[]
}
```

## getActiveMasternodeCount

Returns number of unique masternodes in the last specified number of blocks.

```ts title="client.masternode.getActiveMasternodeCount"
interface masternode {
  getActiveMasternodeCount (blockCount: number = 20160): Promise<number>
}
```

## listAnchors
Returns an array of anchors if any

```ts title="client.masternode.listAnchors"
interface masternode {
  listAnchors (): Promise<MasternodeResult<MasternodeAnchor>> 
}

interface MasternodeAnchor {
  anchorHeight: number
  anchorHash: string
  rewardAddress: string
  dfiRewardHash: string
  btcAnchorHeight: number
  btcAnchorHash: string
  confirmSignHash: string
}

interface MasternodeResult<T> {
  [id: string]: T
}
```

## clearMempool
Clears the memory pool and returns a list of the removed transaction ids.

```ts title="client.masternode.clearMempool"
interface masternode {
  clearMempool (): Promise<string[]> 
}
```
