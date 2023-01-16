import GraphQLJSON from 'graphql-type-json'
import { indexerContainer } from '../..'
import {HiveClient, OFFCHAIN_HOST} from '../../../../utils'
import Axios from 'axios'
import moment from 'moment';
import { Post } from './posts';
import { HiveProfile } from './profiles';


const GRAPHQL_PROFILE = `

query Profile($did: String) {
    ceramicProfile(userId: $did) {
        did
        name
        description
        website
        location
        emoji
        birthDate
        url
        gender
        homeLocation
        residenceCountry
    }
}
`

class CeramicProfile {
    data: any;
    constructor(data: any) {
        this.data = data
    }

    static async run(args: any) {
        //TODO caching/perma-storage
        const {data} = await Axios.post(OFFCHAIN_HOST, {
            query: GRAPHQL_PROFILE,
            variables: {
                did: args.did
            }
        })
        console.log(data)
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
  async latestFeed(args: any) {
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
  async profile(args) {
    
    if(args.username) {
        return await HiveProfile.run({
            username: args.username
        })   
    }

    return null
  },
  async socialPost(args) {
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
  async syncState() {
    const currentStats = await indexerContainer.self.stats.findOne({
      key: "stats"
    })

    return {
      blockLag: currentStats.blockLag,
      syncEtaSeconds: currentStats.syncEtaSeconds,
      latestBlockLagDiff: currentStats.blockLagDiff,
    }
  },
  async trendingTags(args: any) {
    const tagsQuery = await indexerContainer.self.posts.aggregate([
      {
        '$match': {
          'created_at': {
            $gt: moment().subtract('14', 'day').toDate()
          }
        }
      }, {
        '$unwind': {
          'path': '$tags', 
          'includeArrayIndex': 'string', 
          'preserveNullAndEmptyArrays': false
        }
      }, {
        '$group': {
          '_id': '$tags', 
          'score': {
            '$sum': 1
          }
        }
      }, {
        '$sort': {
          'score': -1
        }
      },
      {
        $limit: args.limit || 5
      },
      {
        $project: {
          _id: 0,
          "tag": "$_id",
          score: "$score"
        }
      }
    ])
    const tags = await tagsQuery.toArray();

    return {
      tags
    }
  },
  community: async (args) => {
    const community = await indexerContainer.self.communityDb.findOne({
        _id: `hive/${args.id}`
    })
    console.log(community)
  },
  relatedPosts: async (args) => {
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
  follows: async (args) => {
    const followingResult = await indexerContainer.self.followsDb.find({
      follower: args.id
    }).toArray()
    const followersResult = await indexerContainer.self.followsDb.find({
      following: args.id
    }).toArray()

    return {
      followers: followersResult.map(e => ({...e, followed_at: e.followed_at.toISOString(), 
        follower_profile: async () => Resolvers.profile({username: e.follower}),
        following_profile: async () => Resolvers.profile({username: e.following})
      })),
      followers_count: async () => {
        return await indexerContainer.self.followsDb.countDocuments({
          following: args.id
        })
      },
      followings: followingResult.map(e => ({
        ...e, followed_at: e.followed_at.toISOString(), 
        follower_profile: async () => {console.log('HLELO', await Resolvers.profile({username: e.follower})); return await Resolvers.profile({username: e.follower})},
        following_profile: async () => Resolvers.profile({username: e.following})
      })),
      followings_count: async () => {
        return await indexerContainer.self.followsDb.countDocuments({
          follower: args.id
        })
      },
    }
  }
}
