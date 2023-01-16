import Axios from 'axios'
import { HiveClient, OFFCHAIN_HOST } from "../../../../utils"
import { indexerContainer } from '../../index'
import { HiveProfile } from "./profiles"

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
    
    get off_chain_id() {
      return this.rawDoc.off_chain_id
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
      if (this.off_chain_id) {
        const { data } = await Axios.post(OFFCHAIN_HOST, {
          query: `
          query Query($parent_id: String){
            publicFeed(parent_id: $parent_id) {
            stream_id
            version_id
            parent_id
            creator_id
            title
            body
            category
            lang
            type
            app
            json_metadata
            app_metadata
            debug_metadata
            community_ref
            created_at
            updated_at
          }
        }`,
          variables: {
            parent_id: this.off_chain_id,
          },
        })
  
        console.log('offchain responses', JSON.stringify(data))
        for(let post of data.data.publicFeed) {
          console.log(post)
          let partial = {
            body: post.body,
            title: post.title,
            json_metadata: post.json_metadata,
            app_metadata: post.app_metadata,
            debug_metadata: post.debug_metadata,
            permlink: post.stream_id,
            author: post.creator_id,
            parent_author: this.author,
            parent_permlink: this.permlink,
            created_at: new Date(post.created_at),
            updated_at: new Date(post.updated_at),
            TYPE: "CERAMIC",
            origin_control: {
              allowed_by_type: false,
              allowed_by_parent: true
            },
          }
          console.log(partial)
          try {
            await indexerContainer.self.posts.insertOne(partial)
          } catch {
  
          }
        }
      }
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