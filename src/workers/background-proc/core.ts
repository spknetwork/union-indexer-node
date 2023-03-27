import { Collection } from 'mongodb'
import NodeSchedule from 'node-schedule'
import { mongo } from '../../services/db'
import { createPostStreamID } from '../../services/streamBridge'
import { PostStruct } from '../../types/posts'
import { CERAMIC_HOST, HiveClient } from '../../utils'

export class BackgroundCore {
  communityDb: any
  posts: Collection<PostStruct>
  ceramic: any

  constructor() {
    this.communityRefresh = this.communityRefresh.bind(this)
    this.offchainIdRefresh = this.offchainIdRefresh.bind(this)
    this.postStats = this.postStats.bind(this)
  }

  async createOffchainId(post: PostStruct) {}

  async offchainIdRefresh() {
    let postList = await this.posts
      .find({
        needs_stream_id: true,
        offchain_id: { $exists: false },
        TYPE: 'HIVE',
      })
      .toArray()
    for (let post of postList) {
      console.log(post)
      const stream_id = await createPostStreamID(
        {
          author: post.author,
          permlink: post.permlink,
        },
        this.ceramic,
      )
      console.log(stream_id)
      await this.posts.findOneAndUpdate({
        _id: post._id
      }, {
        $set: {
          offchain_id: stream_id,
          needs_stream_id: false,
        },
      })
    }
  }

  async postStats() {
    const PQueue = (await import('p-queue')).default
    const queue = new PQueue({ concurrency: 50 })

    const items = await this.posts.find({
      $or: [
        {
          'app_metadata.app': { $in: ['3speak'] },
          need_stat_update: true,
        },
        {
          'app_metadata.app': { $in: ['3speak'] },
          need_stat_update: {
            $exists: false,
          },
        },
      ],
    })

    for await (let itm of items) {
      queue.add(async () => {
        //console.log(itm)

        let total_reward = null
        let total_votes = 0
        if ((itm as any).TYPE === 'HIVE') {
          try {
            const data = await HiveClient.call('condenser_api', 'get_content', [
              itm.author,
              itm.permlink,
            ])
            total_reward =
              Number(data.total_payout_value.split(' ')[0]) +
              Number(data.curator_payout_value.split(' ')[0])
            total_votes = data.net_votes
          } catch (ex) {
            // console.log(Object.values(ex.jse_info).join(), [itm.author, itm.permlink])
          }
        }

        const num_comments = await this.posts.countDocuments({
          parent_author: itm.author,
          parent_permlink: itm.permlink,
        })

        await this.posts.findOneAndUpdate({
            _id: itm._id
        }, {
          $set: {
            'stats.num_comments': num_comments,
            'stats.num_votes': total_votes,
            'stats.total_hive_reward': total_reward,
            need_stat_update: false,
          },
        })
      })
      await queue.onSizeLessThan(2500)
    }
    await queue.onIdle()
  }

  async communityRefresh() {
    console.log('Running community refresh')
    for await (let communityRecord of this.communityDb.find({
      needs_update: true,
    })) {
      if (!communityRecord._id.toString().split('/')[1].startsWith('hive-')) {
        continue
      }
      try {
        const communityInfo = await HiveClient.call('bridge', 'get_community', {
          name: communityRecord._id.toString().split('/')[1],
        })
        await this.communityDb.findOneAndUpdate(
          {
            _id: communityRecord._id,
          },
          {
            $set: {
              title: communityInfo.title,
              about: communityInfo.about,
              lang: communityInfo.lang,
              is_nsfw: communityInfo.is_nsfw,
              subscribers: communityInfo.subscribers, //Redo this at some point to be an aggregate function
              created_at: new Date(communityInfo.created_at),
              roles: communityInfo.team,
              needs_update: false,
            },
          },
        )
      } catch (ex) {
        console.log(ex)
      }
    }
  }

  ensureNotRunning(name) {


  }

  async start() {
    const db = mongo.db('spk-union-indexer')
    this.posts = db.collection('posts')
    this.communityDb = db.collection('communities')
    await mongo.connect()
    const { CeramicClient } = await import('@ceramicnetwork/http-client')
    this.ceramic = new CeramicClient(CERAMIC_HOST)

    NodeSchedule.scheduleJob('* * * * *', this.communityRefresh)
    NodeSchedule.scheduleJob('* * * * *', this.postStats)
    NodeSchedule.scheduleJob('* * * * *', this.offchainIdRefresh)
  }
}
