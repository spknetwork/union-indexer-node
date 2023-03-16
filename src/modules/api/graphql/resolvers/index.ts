import { indexerContainer } from '../..'
import {HiveClient, OFFCHAIN_HOST} from '../../../../utils'
import Axios from 'axios'
import moment from 'moment';
import { Post, PostResolvers } from './posts';
import { HiveProfile, ProfileResolvers } from './profiles';


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
  ...PostResolvers,
  ...ProfileResolvers,
  async profile(_, args) {
    if(args.username) {
        return await HiveProfile.run({
            username: args.username
        })   
    }

    return null
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
  async trendingTags(_, args: any) {
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
  async community(_, args) {
    const community = await indexerContainer.self.communityDb.findOne({
        _id: `hive/${args.id}`
    })
    if(!community) {
      return null;
    }
    const roles = community.roles.map(e => {
      const [username, role, title] = e;
      return {
        username, 
        role, 
        title
      }
    })
    return {
      ...community,
      roles,
      created_at: community.created_at.toISOString(),
      feed: async (_, args2) => {

        const items = (await indexerContainer.self.posts.find({
          parent_permlink: args.id
        }, {
          limit: args2.limit || 100,
          skip: args2.skip || 0
        }).toArray()).map(e => new Post(e))
        return {
          items
        }
      }
    }
  },
  async follows(_, args) {
    const followingResult = await indexerContainer.self.followsDb.find({
      follower: args.id
    }).toArray()
    const followersResult = await indexerContainer.self.followsDb.find({
      following: args.id
    }).toArray()

    return {
      followers: followersResult.map(e => ({...e, followed_at: e.followed_at.toISOString(), 
        follower_profile: async () => Resolvers.profile(_, {username: e.follower}),
        following_profile: async () => Resolvers.profile(_, {username: e.following})
      })),
      followers_count: async () => {
        return await indexerContainer.self.followsDb.countDocuments({
          following: args.id
        })
      },
      followings: followingResult.map(e => ({
        ...e, followed_at: e.followed_at.toISOString(), 
        follower_profile: async () => {console.log('HLELO', await Resolvers.profile(_, {username: e.follower})); return await Resolvers.profile(_, {username: e.follower})},
        following_profile: async () => Resolvers.profile(_, {username: e.following})
      })),
      followings_count: async () => {
        return await indexerContainer.self.followsDb.countDocuments({
          follower: args.id
        })
      },
    }
  }
}
