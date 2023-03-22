import { Collection, Db, MongoClient, Timestamp } from 'mongodb'
import { CERAMIC_HOST } from '../utils'
import { logger } from './common/logger.singleton'
import { Models, MONGODB_URL, mongoOffchan } from './db'
// @ts-ignore
import type { CeramicClient } from '@ceramicnetwork/http-client'
import { StreamBridge } from './streamBridge'
import { DelegatedAuthority } from '../types/index'


function CeramicToBasetemplate(data) {


  return {
    status: 'published'
  }
}

export class CoreService {
  self: CoreService
  db: Db
  posts: Collection
  stats: Collection
  streamState: Collection
  followsDb: Collection
  ceramic: CeramicClient
  streamBridge: StreamBridge
  profileDb: Collection
  communityDb: Collection
  delegatedAuthorityDb: Collection<DelegatedAuthority>
  offchainDb: Db

  async offchainSync() {
    try {
      let lastTs = null
      for await (let record of this.offchainDb
        .watch([], {
          fullDocument: 'updateLookup',
          startAtOperationTime: new Timestamp({ t: 0, i: 2 }),
        })
        .stream()) {
        const fullDocument = (record as any).fullDocument
  
        if ((record as any).ns.coll === 'graph.docs') {
          if (fullDocument.content) {
            await this.posts.findOneAndUpdate(
              {
                id: fullDocument.id,
              },
              {
                $set: {
                  title: fullDocument.content.title,
                  body: fullDocument.content.body,
  
                  origin_control: {
                    allowed_by_parent: false,
                    allowed_by_type: true,
                  },
                  tags: [],
  
                  permlink: fullDocument.id,
                  author: fullDocument.creator_id,
  
                  created_at: fullDocument.created_at,
                  updated_at: new Date(fullDocument.updated_at),
                  local_update_at: new Date(),
  
                  TYPE: 'CERAMIC',
                  state_control: {
                    version_id: fullDocument.version_id,
                  },
                },
              },
              {
                upsert: true,
              },
            )
          }
        }
        // console.log(record)
        const ts = record.clusterTime.toString()
        lastTs = ts
      }
    } catch (ex) {
      console.log(ex)
    }
  }

  async start() {
    const url = MONGODB_URL
    const mongo = new MongoClient(url)
    await mongo.connect()

    this.offchainDb = mongoOffchan.db('spk-indexer-test')

    console.log(this.offchainDb)

    logger.info(`Connected successfully to mongo at ${MONGODB_URL}`)

    this.db = mongo.db('spk-union-indexer')

    this.posts = this.db.collection('posts')
    this.streamState = this.db.collection('stream_state')
    this.stats = this.db.collection('stats')
    this.followsDb = this.db.collection('follows')
    this.profileDb = this.db.collection('profiles')
    this.communityDb = this.db.collection('communities')
    this.delegatedAuthorityDb = this.db.collection<DelegatedAuthority>('delegated-authority')

    if(process.env.OFFCHAIN_BRIDGE_ENABLED === "true") {
      await mongoOffchan.connect()
      this.offchainSync()
    }

    
    //We still need to use Ceramic on the union indexer a small amount.
    // However, any Ceramic heavy operations should utilize the offchain indexer.
    const { CeramicClient } = await import('@ceramicnetwork/http-client')

    this.ceramic = new CeramicClient(CERAMIC_HOST)

    this.streamBridge = new StreamBridge(this)
    try {
      for(let model of Object.values(Models)) {
        await model.syncIndexes()
      }
    } catch (ex) {
      console.log(ex)
    }

    // try {
    //   await this.streamState.createIndex(
    //     {
    //       key: 1,
    //     },
    //     {
    //       unique: true,
    //     },
    //   )
    // } catch {}

    // try {
    //   await this.delegatedAuthorityDb.createIndex({
    //     to: -1,
    //   })
    // } catch {}

    // try {
    //   await this.delegatedAuthorityDb.createIndex({
    //     from: -1,
    //   })
    // } catch {}
  }
}
