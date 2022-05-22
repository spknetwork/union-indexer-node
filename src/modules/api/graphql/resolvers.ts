import GraphQLJSON from 'graphql-type-json'
import { indexerContainer } from '..'
import {HiveClient} from '../../../utils'

class HiveProfile {
    rawBlob: any;
    constructor(rawBlob) {
        this.rawBlob = rawBlob;
    }


    get location() {
        return this.rawBlob.posting_json_metadata?.profile?.location || null
    }

    get name() {
        return this.rawBlob.posting_json_metadata?.profile?.name || null
    }

    get username() {
        return this.rawBlob.name
    }
    
    get about() {
        return this.rawBlob.posting_json_metadata?.profile?.about || null
    }

    get website() {
        return this.rawBlob.posting_json_metadata?.profile?.website || null
    }

    get json_metadata() {
        return this.rawBlob.json_metadata || null
    }
    
    get posting_json_metadata() {
        return this.rawBlob.posting_json_metadata || null
    }

    get images() {
        return {
            avatar: this.rawBlob.posting_json_metadata?.profile?.profile_image || null,
            background: this.rawBlob.posting_json_metadata?.profile?.cover_image || null
        }
    }
    
    get __typename() {
        return "HiveProfile"
    }

    static async run(args) {
        const accounts = await HiveClient.database.getAccounts([
            args.username
        ])
        const account = accounts[0]
        try {
            account.json_metadata = JSON.parse(account.json_metadata)
        } catch (ex) {
            //console.log(ex)
        }
        try {

            ;(account as any).posting_json_metadata = JSON.parse((account as any).posting_json_metadata)
        } catch (ex) {
            //console.log((account as any).posting_json_metadata )
            //console.log(ex)
            //Parse json_metadata as valid for now
            try {
                ;(account as any).posting_json_metadata = JSON.parse((account as any).json_metadata)
            } catch {
            }
        }

        return new HiveProfile(account);
    }
}

export class Post {
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

  get stream_id() {
    return this.rawDoc.stream_id
  }

  get version_id() {
    return this.rawDoc.version_id
  }

  get parent_id() {
    return this.rawDoc.parent_id
  }

  get title() {
    return this.rawDoc.title
  }

  get body() {
    return this.rawDoc.body
  }

  get category() {
    return this.rawDoc.category
  }

  get refs() {
    return this.rawDoc.refs
  }

  get tags() {
    return this.rawDoc.json_metadata.tags
  }

  get image() {
    return this.rawDoc.json_metadata.image
  }

  get json_metadata() {
    return this.rawDoc.json_metadata
  }

  get app() {
    return this.rawDoc.json_metadata.app
  }

  get post_type() {
    return this.rawDoc.post_type
  }

  get __typename() {
    if(this.rawDoc.TYPE === "HIVE") {
        return 'HivePost'
    }
    if(this.rawDoc.TYPE === "CERAMIC") {
        return 'CeramicPost'
    }
  }

  get created_at() {
    return new Date(this.rawDoc.created_at).toISOString()
  }

  get updated_at() {
    return new Date(this.rawDoc.updated_at).toISOString()
  }

  get three_video() {
      const json_metadata = this.rawDoc.json_metadata;
      if(!json_metadata?.video?.info?.duration) {
        return null;
      }
      const images = this.rawDoc.json_metadata.image || []

      const possible_play_url = (this.rawDoc.json_metadata?.video?.info?.sourceMap || []).find(e => e.type === "video")?.url

      //console.log('possible_play_url', possible_play_url)
      return {
          thumbnail_url: images.pop(),
          play_url: possible_play_url ? possible_play_url : `https://threespeakvideo.b-cdn.net/${this.rawDoc.permlink}/default.m3u8`,
          duration: json_metadata.video.info.duration
      }
  }
  

  get author() {
    return this.rawDoc.author
  }

  get stats() {
    return this.rawDoc.stats;
  }

  async author_profile () {
    return await HiveProfile.run({
        username: this.rawDoc.author
    })
  }

  async children(args) {
    return (await indexerContainer.self.posts
      .find(
        {
          parent_permlink: this.rawDoc.permlink,
          parent_author: this.rawDoc.author
        },
        {
          limit: args.limit || 100,
          skip: args.skip,
        },
      )
      .toArray()).map(e => new Post(e))
  }

  async parent_post() {
    const post = await indexerContainer.self.posts.findOne({
        permlink: this.parent_permlink,
        author: this.parent_author
    })
    if(!post) {
        return null;
    }

    return new Post(post)
  }
  
  async community() {
    const permink = this.parent_permlink;
    if(permink.startsWith('hive-')) {
        const communityInfo = await HiveClient.call('bridge', 'get_community', {
            name: permink
        })

        return communityInfo
    } else {
        return;
    }
  }
}
export const Resolvers = {
  JSON: GraphQLJSON,
  async publicFeed(args: any) {
    const mongodbQuery = {}
    if (args.parent_permlink) {
      mongodbQuery['parent_permlink'] = args.parent_permlink
    }
    if (args.author) {
      mongodbQuery['author'] = args.author
    }
    if (args.permlink) {
      mongodbQuery['permlink'] = args.permlink
    }
    return {
      items: (
        await indexerContainer.self.posts
          .find(mongodbQuery, {
            limit: args.limit || 100,
            skip: args.skip,
          })
          .toArray()
      ).map((e) => new Post(e)),
    }
  },
  async latestFeed(args: any) {
    const mongodbQuery = {}
    if (args.parent_permlink) {
      mongodbQuery['parent_permlink'] = args.parent_permlink
    }
    if (args.author) {
      mongodbQuery['author'] = args.author
    }
    if (args.permlink) {
      mongodbQuery['permlink'] = args.permlink
    }
    if(!args.allow_comments) {
        mongodbQuery['parent_author'] = {
            $eq: ""
        }
    }
    console.log(mongodbQuery)
    return {
      items: (
        await indexerContainer.self.posts
          .find(mongodbQuery, {
            limit: args.limit || 100,
            skip: args.skip,
            sort: {
                created_at: -1
            }
          })
          .toArray()
      ).map((e) => new Post(e)),
    }
  },
  async profile(args) {
    
    if(args.username) {
        return await HiveProfile.run({
            username: args.username
        })   
    }

    return null
  }
}
