import Axios from 'axios'
import { HiveClient, OFFCHAIN_HOST } from '../../../../utils'
import { indexerContainer } from '../../index'
import { CeramicProfile, HiveProfile } from './profiles'

export class HivePost {
  rawDoc: any

  constructor(rawDoc: any) {
    this.rawDoc = rawDoc
  }

  get parent_author() {
    return this.rawDoc.parent_author
  }

  get parent_permlink() {
    return this.rawDoc.parent_permlink
  }

  get permlink() {
    return this.rawDoc.permlink
  }

  get state_control() {
    return this.rawDoc.state_control
  }

  get title() {
    return this.rawDoc.title
  }

  get body() {
    return this.rawDoc.body
  }

  get refs() {
    //TODO: Calculate refs on DB backend. Maybe through JS or aggregate function
    return [`hive:${this.rawDoc.author}:${this.permlink}`]
  }

  get post_type() {
    return this.rawDoc.app_metadata?.type
  }

  get tags() {
    return this.rawDoc.tags
  }

  get json_metadata() {
    return {
      image: this.rawDoc.json_metadata.image,
      app: this.rawDoc.json_metadata.app,
      raw: this.rawDoc.json_metadata
    }
  }

  get app_metadata() {
    return this.rawDoc.app_metadata
  }

  get app() {
    return this.rawDoc.app_metadata.app
  }

  get off_chain_id() {
    return this.rawDoc.off_chain_id
  }

  get __typename() {
    if (this.rawDoc.TYPE === 'HIVE') {
      return 'HivePost'
    }
    if (this.rawDoc.__t === 'post_ceramic') {
      return 'CeramicPost'
    }
  }

  get lang() {
    if (this.rawDoc.json_metadata.video) {
      if (this.rawDoc.json_metadata.video.info.lang) {
        return this.rawDoc.json_metadata.video.info.lang
      }
    }
    return null
  }

  get community_ref() {
    if (this.parent_permlink.startsWith('hive-')) {
      return this.parent_permlink
    } else {
      return null
    }
  }

  get created_at() {
    return this.rawDoc.created_at
  }

  get updated_at() {
    return this.rawDoc.updated_at
  }

  get spkvideo() {
    const json_metadata = this.rawDoc.json_metadata
    if (!json_metadata?.video?.info?.duration) {
      return null
    }
    const images = this.rawDoc.json_metadata.image || []

    const possible_play_url = (this.rawDoc.json_metadata?.video?.info?.sourceMap || []).find(
      (e) => e.type === 'video',
    )?.url

    console.log('possible_play_url', possible_play_url, images)

    const thumbnail_url = `https://media.3speak.tv/${this.permlink}/thumbnails/default.png`
    return {
      thumbnail_url: images.pop() || thumbnail_url,
      play_url: possible_play_url
        ? possible_play_url
        : `https://threespeakvideo.b-cdn.net/${this.rawDoc.permlink}/default.m3u8`,
      duration: json_metadata.video.info.duration,
      height: this.rawDoc.app_metadata?.spkvideo?.height ?? 0.0,
      width: this.rawDoc.app_metadata?.spkvideo?.width ?? 0.0,
      is_short: this.rawDoc.app_metadata?.spkvideo?.is_short ?? false,
      //Body without HIVE post headers such as "Watch on 3Speak"
      body: this.body.split('---\n\n')[1],
    }
  }

  get hive_rewards() {
    return this.rawDoc.hive_rewards || null;
  }

  async author() {
    return {
      id: this.rawDoc.author,
      username: this.rawDoc.author,
      profile: async () => {
        if (this.rawDoc.__t === 'post_ceramic') {
          return await CeramicProfile.run({
            id: this.rawDoc.author,
          })
        }
        return await HiveProfile.run({
          username: this.rawDoc.author,
        })
      },
    }
  }

  get stats() {
    return this.rawDoc.stats
  }

  async children(_, args) {
    // if (this.off_chain_id) {
    //   const { data } = await Axios.post(OFFCHAIN_HOST, {
    //     query: `
    //       query Query($parent_id: String){
    //         publicFeed(parent_id: $parent_id) {
    //         stream_id
    //         version_id
    //         parent_id
    //         creator_id
    //         title
    //         body
    //         category
    //         lang
    //         type
    //         app
    //         json_metadata
    //         app_metadata
    //         debug_metadata
    //         community_ref
    //         created_at
    //         updated_at
    //       }
    //     }`,
    //     variables: {
    //       parent_id: this.off_chain_id,
    //     },
    //   })

    //   console.log('offchain responses', JSON.stringify(data))
    //   for (let post of data.data.publicFeed) {
    //     console.log(post)
    //     let partial = {
    //       body: post.body,
    //       title: post.title,
    //       json_metadata: post.json_metadata,
    //       app_metadata: post.app_metadata,
    //       debug_metadata: post.debug_metadata,
    //       permlink: post.stream_id,
    //       author: post.creator_id,
    //       parent_author: this.author,
    //       parent_permlink: this.permlink,
    //       created_at: new Date(post.created_at),
    //       updated_at: new Date(post.updated_at),
    //       TYPE: 'CERAMIC',
    //       origin_control: {
    //         allowed_by_type: false,
    //         allowed_by_parent: true,
    //       },
    //     }
    //     console.log(partial)
    //     try {
    //       await indexerContainer.self.posts.insertOne(partial)
    //     } catch {}
    //   }
    // }
    return (
      await indexerContainer.self.posts
        .find(
          {
            parent_permlink: this.rawDoc.permlink,
            parent_author: this.rawDoc.author,
          },
          {
            limit: args.limit || 100,
            skip: args.skip,
          },
        )
        .toArray()
    ).map((e) => new HivePost(e))
  }

  async parent_post() {
    const post = await indexerContainer.self.posts.findOne({
      permlink: this.parent_permlink,
      author: this.parent_author,
    })
    if (!post) {
      return null
    }

    return new HivePost(post)
  }

  async community() {
    const permlink = this.parent_permlink
    if (permlink.startsWith('hive-')) {
      // const communityInfo = await HiveClient.call('bridge', 'get_community', {
      //   name: permlink,
      // })

      const communityDb = await indexerContainer.self.communityDb.findOne({
        _id: `hive/${permlink}`,
      })
      // console.log('communityDb', communityDb)
      return communityDb
    } else {
      return null
    }
  }
}
