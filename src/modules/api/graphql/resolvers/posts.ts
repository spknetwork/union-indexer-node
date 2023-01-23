import Axios from 'axios'
import moment from 'moment'
import { HiveClient, OFFCHAIN_HOST } from "../../../../utils"
import { indexerContainer } from '../../index'
import { HiveProfile } from "./profiles"

export class CeramicPost {

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
      //TODO: Calculate refs on DB backend. Maybe through JS or aggregate function
      return [`hive:${this.author}:${this.permlink}`]
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
  
    get off_chain_id() {
      return this.rawDoc.off_chain_id
    }

    get post_type() {
      if(this.rawDoc.json_metadata.app.startsWith('3speak/')) {
        return "3speakvideo"
      } else {
        return "hive_post"
      }
    }
  
    get __typename() {
      if(this.rawDoc.TYPE === "HIVE") {
          return 'HivePost'
      }
      if(this.rawDoc.TYPE === "CERAMIC") {
          return 'CeramicPost'
      }
    }

    get lang() {
      if(this.rawDoc.json_metadata.video) {
        if(this.rawDoc.json_metadata.video.info.lang) {
          return this.rawDoc.json_metadata.video.info.lang;
        }
      }
      return null;
    }

    get community_ref() {
      if(this.parent_permlink.startsWith('hive-')) {
        return this.parent_permlink
      } else {
        return null;
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
  
        console.log('possible_play_url', possible_play_url, images)
        
        const thumbnail_url = `https://media.3speak.tv/${this.permlink}/thumbnails/default.png`
        return {
            thumbnail_url: images.pop() || thumbnail_url,
            play_url: possible_play_url ? possible_play_url : `https://threespeakvideo.b-cdn.net/${this.rawDoc.permlink}/default.m3u8`,
            duration: json_metadata.video.info.duration,
            is_short: json_metadata.video.info.duration < 60
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
      const permlink = this.parent_permlink;
      if(permlink.startsWith('hive-')) {
          const communityInfo = await HiveClient.call('bridge', 'get_community', {
              name: permlink
          })

          const communityDb = await indexerContainer.self.communityDb.findOne({
            _id: `hive/${permlink}`
          })
          // console.log('communityDb', communityDb)
          return communityInfo
      } else {
          return null;
      }
    }
  }

export const PostResolvers = {
  async relatedPosts(_, args) {
    const postContent = await indexerContainer.self.posts.findOne({
      permlink: args.permlink,
      author: args.author
    });
    console.log(postContent.tags)
    let OrQuery = []

    OrQuery.push({
      tags: {$in: postContent.tags} 
    })
    
    if(postContent.parent_author === "") {
      OrQuery.push({
        parent_permlink: postContent.parent_permlink
      })
    }
    
    const items = await indexerContainer.self.posts.aggregate([{
      $match: {
        $or: OrQuery
        
      }
    }, {
      $sample: {
        size: 25
      }
    }]).toArray()

    return {
      parentPost: new Post(postContent),
      items: items.map(e => new Post(e))
    }
  },
  async socialPost(_, args) {
    let mongodbQuery = {

    }
    
    if(args.author) {
      mongodbQuery['author'] = args.author;
    }
    if(args.permlink) {
      mongodbQuery['permlink'] = args.permlink;
    }
    return new Post(await indexerContainer.self.posts.findOne(mongodbQuery))
  },
  async followingFeed(args: any) {
    let following = []
    if(args.follower.startsWith("did:")) {
      const { data } = await Axios.post(OFFCHAIN_HOST, {
        query: `
        query Query($follower: String){
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
          follower: args.follower,
        },
      })

    } else {
      const data = await HiveClient.database.call('get_following', [
        args.follower
      ])

      data.map(e => {
        following.push(e.following)
      })
    }

    const out = await indexerContainer.self.posts.find({
      author: {
        $in: following
      }
    }, {
      limit: args.limit || 100,
      skip: args.skip,
      sort: {
        "created_at": -1
      },
    }).toArray()

    return {
      items: out.map(e => {
        return new Post(e)
      })
    }
  },
  async latestFeed(_, args: any) {
    const mongodbQuery = {
        //"TYPE": "CERAMIC"
    }
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
            $in: ["", null]
        }
    }
    if(args.apps) {
      mongodbQuery['json_metadata.app'] = {
        $in: args.apps
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
      ).map((e) => {
        return new Post(e)
      }),
    }
  },
  async trendingFeed(args: any) {
    const mongodbQuery = {
      //"TYPE": "CERAMIC"
      created_at: {
        $gt: moment().subtract('7', 'day').toDate()
      }
    }
    if(!args.allow_comments) {
        mongodbQuery['parent_author'] = {
            $in: ["", null]
        }
    }
    if(args.apps) {
      mongodbQuery['json_metadata.app'] = {
        $in: args.apps
      }
    }
    return {
      items: (
        await indexerContainer.self.posts
          .find(mongodbQuery, {
            limit: args.limit || 100,
            skip: args.skip,
            sort: {
              "stats.num_comments": -1
            }
          })
          .toArray()
      ).map((e) => {
        return new Post(e)
      }),
    }
  }, 
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
    if(args.apps) {
      mongodbQuery['json_metadata.app'] = {
        $in: args.apps
      }
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
  async tagFeed(_, args: any) {
    return {
      items: (
        await indexerContainer.self.posts
          .find({
            tags: {
              $in: [args.tag]
            }
          }, {
            limit: args.limit || 100,
            skip: args.skip,
          })
          .toArray()
      ).map((e) => new Post(e)),
    }
  },
  async firstUploadsFeeds(_, args: any) {
    return {
      items: (
        await indexerContainer.self.posts
          .find({
            "video.first_upload": {
              $eq: true
            }
          }, {
            limit: args.limit || 100,
            skip: args.skip,
            sort: {
              created_at: -1
            }
          })
          .toArray()
      ).map((e) => new Post(e)),
    }
  }
}