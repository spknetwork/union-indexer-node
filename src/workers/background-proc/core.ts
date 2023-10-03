import { Client } from '@hiveio/dhive'
import { Collection } from 'mongodb'
import NodeSchedule from 'node-schedule'
import { mongo } from '../../services/db'
import { createPostStreamID } from '../../services/streamBridge'
import { PostStruct } from '../../types/posts'
import { CERAMIC_HOST, HiveClient } from '../../utils'
import Axios from 'axios'

export const HiveClient2 = new Client([
  'https://hive-api.3speak.tv',
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://anyx.io',
  'https://hived.privex.io',
  'https://rpc.ausbit.dev',
  'https://hived.emre.sh',
  'https://api.deathwing.me',
  'https://api.c0ff33a.uk'
])

interface VideoSize {
  height: number;
  width: number;
}

export class BackgroundCore {
  communityDb: any
  posts: Collection<PostStruct>
  ceramic: any
  profilesDb: Collection

  constructor() {
    this.communityRefresh = this.communityRefresh.bind(this)
    this.updateHeightWeight = this.updateHeightWeight.bind(this)
    this.offchainIdRefresh = this.offchainIdRefresh.bind(this)
    this.postStats = this.postStats.bind(this)
    this.scoreChannels = this.scoreChannels.bind(this)
    this.pullAllAccounts = this.pullAllAccounts.bind(this)
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
          needs_stat_update: true,
        },
        {
          needs_stat_update: {
            $exists: false,
          },
        },
      ],
    }, {
      limit: 6000
    })


    for await (let itm of items) {
      queue.add(async () => {

        let total_reward = null
        let total_votes = 0
        if ((itm as any).TYPE === 'HIVE') {
          try {
            const data = await HiveClient2.call('condenser_api', 'get_content', [
              itm.author,
              itm.permlink,
            ])
            total_reward = data.last_payout <= "1970-01-01T00:00:00" ? parseFloat(data.pending_payout_value) : parseFloat(data.total_payout_value) + parseFloat(data.curator_payout_value)
            total_votes = data.net_votes
            const num_comments = await this.posts.countDocuments({
              parent_author: itm.author,
              parent_permlink: itm.permlink,
            })
    
            // console.log('needs stats update done', itm.permlink)
            await this.posts.findOneAndUpdate({
                _id: itm._id
            }, {
              $set: {
                'stats.num_comments': num_comments,
                'stats.num_votes': total_votes,
                'stats.num_up_votes': data.active_votes.filter(e => e.rshares > 0).length,
                'stats.num_down_votes': data.active_votes.filter(e => e.rshares < 0).length,
                'stats.total_hive_reward': total_reward,
                
                'hive_rewards.max_accepted_payout': data.max_accepted_payout,
                'hive_rewards.max_cashout_time': data.max_cashout_time,
                'hive_rewards.cashout_time': data.cashout_time,
                'hive_rewards.total_payout_value': data.total_payout_value,
                'hive_rewards.curator_payout_value': data.curator_payout_value,
                'hive_rewards.payout': total_reward,
                'hive_rewards.payout_at': data.last_payout,


                needs_stat_update: false,
              },
            })
          } catch (ex) {
            if(ex.jse_info) {
              if(Object.values(ex.jse_info).join().includes('was deleted')) {
                await this.posts.findOneAndUpdate({
                    _id: itm._id
                }, {
                  $set: {
                    status: 'deleted',
                    needs_stat_update: false,
                  },
                })
              }
            }
            // console.log(Object.values(ex.jse_info).join())
            // console.log(Object.values(ex.jse_info).join(), [itm.author, itm.permlink])
          }
        }

      })
      await queue.onSizeLessThan(2500)
    }
    await queue.onIdle()
  }

  async getVideoSize(url: string): Promise<VideoSize> {
    try {
      const text = await Axios.get(url);
      const textData = text.data;
      console.log(textData);
      let regex = /RESOLUTION=(.+),/g;
      let found = textData.match(regex);
      if (found === null || found.length === 0) {
        regex = /RESOLUTION=(.+)\n/g;
        found = textData.match(regex);
      }
      const size = found[0].replace('RESOLUTION=', '').replace(',', '').replace('\n', '');
      console.log(`Size ${size}`);
      const sizeComps = size.split(`x`);
      return {
        width: parseInt(sizeComps[0]),
        height: parseInt(sizeComps[1]),
      }
    } catch (e) {
      console.log(`Error is ${e.message}`);
      // those which fail, doesn't have the valid URL for the video & video-posts are too old.
      // So, it is okay to set 0 for height & width.
      return {
        width: 0.0,
        height: 0.0,
      }
    }
  }

  async updateHeightWeight() {
    const PQueue = (await import('p-queue')).default
    const queue = new PQueue({ concurrency: 50 })

    // Step 1. Find all posts having 3speak as app name and height-width is null (not updated)
    const items = await this.posts.find({
      parent_author: "",
      "json_metadata.app": {
        '$regex': '3speak'
      }, 
      "app_metadata.spkvideo.height": { $eq: null },
      "app_metadata.spkvideo.width": { $eq: null },
    }, {
      limit: 2000
    })

    // Step 2. Find Play URL for each item, and get video size - height, width & update it.
    for await (let itm of items) {
      queue.add(async () => {
        // Step 2.1. get possible play url
        let play_url = (itm.json_metadata?.video?.info?.sourceMap || []).find(
          (e) => e.type === 'video',
        )?.url
        play_url = play_url
          ? play_url
          : `https://threespeakvideo.b-cdn.net/${itm.permlink}/default.m3u8`
        if (play_url.startsWith('ipfs://')) {
          play_url = `https://ipfs-3speak.b-cdn.net/ipfs/${play_url.replace("ipfs://","")}`;
        }
        // Step 2.2 get video size.
        const size = await this.getVideoSize(play_url);

        // Step 2.3 - get video duration
        const duration = itm.json_metadata?.video?.info?.duration ?? 0.0

        // Step 2.4 - is video a 3Shorts?
        const isShort: boolean = duration <= 90.0 && size.height >= size.width;

        // Step 2.5 Update in the db
        await this.posts.findOneAndUpdate(
          { _id: itm._id }, 
          { 
            $set: { 
              'app_metadata.spkvideo.height': size.height, 
              'app_metadata.spkvideo.width': size.width,
              'app_metadata.spkvideo.is_short': isShort,
            } 
          }
        )
      })
      await queue.onSizeLessThan(1000)
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
              description: communityInfo.description,
              flag_text: communityInfo.flag_text,
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
        // console.log(ex)
      }
    }
  }

  async scoreChannels() {
    // const firstCreators =  await posts.distinct('author', {
  //   'json_metadata.app': { $regex: '3speak/' },
  //   "video.first_upload": true
  // })
  // console.log('Number of first authors', firstCreators.length)
  // for (let author of await posts.distinct('author', {
  //   'json_metadata.app': { $regex: '3speak/' },
  //   author: {$nin: firstCreators}
  // })) {
  //   await posts.findOneAndUpdate({
  //     'json_metadata.app': { $regex: '3speak/' },
  //     author
  //   }, {
  //     $set: {
  //       'video.first_upload': true
  //     }
  //   }, {
  //     sort: {
  //       created_at: 1
  //     }
  //   })
  //   // console.log(creator)
  // }

  const activeCreators = []

  const videosAll = await this.posts
    .aggregate([
      {
        $match: {
          //   status: 'published'
          //   created_at: {
          //     // $gt: moment().subtract('1', 'month')
          //   },
          'app_metadata.app': '3speak' 
        },
      },
      {
        $project: {
          author: 1,
          _id: 1,
        },
      },
      {
        $group: {
          _id: null,
          author: { $addToSet: '$author' },
        },
      },
    ])
    .toArray()
  console.log(videosAll)

  for (let author of videosAll[0].author) {
    // console.log(creator)
    const videos = await this.posts.find({
    //   created_: { $gt: moment().subtract('1', 'month') },
      author: author,
      'app_metadata.app': '3speak' 
    })

    let totalComments = 0;
    let totalVotes = 0;
    for await (let vid of videos) {
    //   console.log(vid)
      const firstLevelComments = await this.posts.countDocuments({
        parent_author: vid.author,
        parent_permlink: vid.permlink,
      })

      totalVotes = totalVotes + vid.stats?.num_votes || 0;

      //TODO: Do recursive comments
      totalComments = totalComments + firstLevelComments
    }
    // console.log(totalComments / (totalVotes || 1))
    const score = (totalComments * 3) + (totalVotes * 0.1)
    if(score > 0) {
        activeCreators.push(author)
        await this.profilesDb.findOneAndUpdate({
            username: author
        }, {
            $set: {
                score
            }
        })
    }
  }
  await this.profilesDb.updateMany({
    username: {
      $nin: activeCreators
    }
  }, {
    $set: {
        score: 0
    }
  })
  }

  ensureNotRunning(name) {


  }

  /**
   * Only handles first time viewing.. Afterwards 
   */
  async pullAllAccounts() {
    const allAccountsLocally = await this.posts.distinct('author')

    let profilesToQuery = []
    for(let author of allAccountsLocally) {
      const profile = await this.profilesDb.findOne({
        username: author
      })
      if(!profile) {
        if(profilesToQuery.length >= 20) {
          const profilesHive = await HiveClient.database.getAccounts(profilesToQuery)
  
          for(let profileData of profilesHive) {

            const json_metadata = (profileData as any).posting_json_metadata || (profileData as any).json_metadata
            if(!json_metadata) {
              continue;
            }
    
            try {
              const posting_json_metadata = JSON.parse(json_metadata)
                  
              if(!posting_json_metadata.profile) {
                continue;
              }
              await this.profilesDb.findOneAndUpdate({
                _id: `hive/${profileData.name}`
              }, {
                $set: {
                  username: profileData.name,
                  TYPE: "HIVE",
                  displayName: posting_json_metadata.profile?.name,
                  about: posting_json_metadata.profile?.about,
                  location: posting_json_metadata.profile?.location,
                  website: posting_json_metadata.profile?.website,
                  "extra.pinned_post": posting_json_metadata.profile?.pinned,
                  "images.avatar": posting_json_metadata.profile?.profile_image,
                  "images.cover": posting_json_metadata.profile?.cover_image,
                  "did": posting_json_metadata.did,
                }
              }, {
                upsert: true,
                retryWrites: true
              })
            } catch {
              
            }
          }
  
          profilesToQuery = []
        } else {
          profilesToQuery.push(author)
        }

      }
    }
  }

  async start() {
    const db = mongo.db('spk-union-indexer')
    this.posts = db.collection('posts')
    this.profilesDb = db.collection('profiles')
    this.communityDb = db.collection('communities')
    await mongo.connect()
    const { CeramicClient } = await import('@ceramicnetwork/http-client')
    this.ceramic = new CeramicClient(CERAMIC_HOST)

    NodeSchedule.scheduleJob('0 */6 * * *', this.pullAllAccounts)
    NodeSchedule.scheduleJob('* * * * *', this.communityRefresh)
    NodeSchedule.scheduleJob('*/10 * * * *', this.updateHeightWeight)
    NodeSchedule.scheduleJob('* * * * *', this.postStats)
    NodeSchedule.scheduleJob('* * * * *', this.offchainIdRefresh)
    // this.postStats()
  }
}
