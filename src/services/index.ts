import { Collection, Db, MongoClient, Timestamp } from 'mongodb'
import { CERAMIC_HOST } from '../utils'
import { logger } from './common/logger.singleton'
import { Models, MONGODB_URL, mongoOffchan } from './db'
// @ts-ignore
import type { CeramicClient } from '@ceramicnetwork/http-client'
import { StreamBridge } from './streamBridge'
import { DelegatedAuthority } from '../types/index'
import { PostStruct } from '../types/posts'



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
  socialConnections: Collection

  async offchainSync() {
    let lastTs = null
    let totalHistoryRecords = 0;

    const lastTsDb = await this.streamState.findOne({
      id: "offchaindb-sync"
    })

    let startTs
    if(lastTsDb) {
      startTs = new Timestamp(lastTsDb.lastTs)
      
    } else {
      startTs = new Timestamp({t: 0, i: 0})
    }

    setInterval(async() => {
      await this.streamState.findOneAndUpdate({
        id: "offchaindb-sync"
      }, {
        $set: {
          lastTs
        }
      }, {
        upsert: true
      })
    }, 1000)
    
    try {
      for await (let record of this.offchainDb
        .watch([], {
          fullDocument: 'updateLookup',
          startAtOperationTime: startTs,
        })
        .stream()) {
        const fullDocument = (record as any).fullDocument
          
        const updatedFields = Object.keys((record as any).updateDescription?.updatedFields || []);
        //Ensure collection is graph.docs & ensure we only process large updates rather than basic metadata changes
        if ((record as any).ns.coll === 'graph.docs' && (updatedFields[0] !== 'last_pinged' || updatedFields.length !== 1)) {
          if (fullDocument.content) {
            const content = fullDocument.content;

            let flags = []

            if(fullDocument.parent_headers?.permlink) {
              flags.push('comment')
            }

            const $set: PostStruct = {

              parent_author: fullDocument.parent_headers?.author || null,
              parent_permlink: fullDocument.parent_headers?.permlink || null,
              author: fullDocument.creator_id,
              permlink: fullDocument.app_metadata?.permlink || null,
              status: 'published',
              title: content.title,
              body: content.body,
              tags: content?.json_metadata?.tags || [],
              updated_at: fullDocument.updated_at,
              created_at: fullDocument.created_at,
              metadata_status: 'unprocessed',
              need_stat_update: false,
              state_control: {
                version_id: fullDocument.version_id
              },
              origin_control: {
                allowed_by_parent: false,
                allowed_by_type: true,
                allowed_by_community: false
              },
              // json_metadata: {
              //   image: [],
              //   tags: [],
              //   app: ''
              // },
              json_metadata: content?.json_metadata,
              app_metadata: {
                types: []
                // spkvideo: {
                //   authority_signed: false,
                //   storage_type: 'legacy',
                //   first_upload: false
                // }
              },
              ipfs_links: [],
              beneficiaries: [],
              __v: '0.1',
              __t: 'post_ceramic',
              flags
            }
            await this.posts.findOneAndUpdate(
              {
                id: fullDocument.id,
              },
              {
                $set
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
        // console.log(lastTs)
        totalHistoryRecords = totalHistoryRecords + 1;
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

    this.socialConnections = this.offchainDb.collection('social_connections')
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
