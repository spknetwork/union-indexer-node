import { JSONDefinition } from "graphql-scalars"

export const Schema = `
    ${JSONDefinition}
    type ProfileImages {
        avatar: String
        cover: String
    }
    interface BaseProfile {
        id: String 
        name: String
        about: String

        src: String
    }
    
    type CeramicProfile implements BaseProfile {
        id: String 
        name: String
        about: String

        did: String
        images: ProfileImages
        website: String
        location: String

        src: String
    }
    
    type HiveProfile implements BaseProfile {
        id: String 
        username: String
        name: String
        about: String

        images: ProfileImages
        posting_json_metadata: String
        json_metadata: String
        website: String
        location: String
        did: String

        src: String
    } 

    union MergedProfile = HiveProfile | CeramicProfile


    type Follow {
        follower: String
        follower_profile: MergedProfile
        following: String
        following_profile: MergedProfile
        followed_at: String
    }

    type FollowOverview {
        followings_count: Int
        followings: [Follow]
        followers_count: Int
        followers: [Follow]
    }

    type TrendingTag {
        tag: String
        score: Int
    }

    type TrendingTags {
        tags: [TrendingTag]
    }

    type Notification {
        target: String
        type: String
        mentioned_at: String
        ref: String
        
        post: JSON
    }

    type PostStats {
        num_comments: Int
        num_votes: Int
        total_hive_reward: Float
    }

    interface SocialPost {
        parent_author: String
        parent_permlink: String

        permlink: String

        title: String
        body: String
        
        author: String
        author_profile: MergedProfile

        stats: PostStats

        json_metadata: JSON

        children: [MergedPost]

        created_at: String
        updated_at: String
    }

    type CeramicPost implements SocialPost {
        parent_author: String
        parent_permlink: String

        permlink: String

        title: String
        body: String

        created_at: String
        updated_at: String

        json_metadata: JSON
        app_metadata: JSON
        debug_metadata: JSON

        author: String
        author_profile: CeramicProfile

        stats: PostStats
        
        children: [MergedPost]

        parent_post: MergedPost

        # Same type as HivePost, interchangeable with stream_id
        off_chain_id: String

        #  Ceramic legacy fields
        stream_id: String
        parent_id: String
        version_id: String

        # Access original content on Ceramic
        original_content: JSON

    }
    
    type HivePost {
        parent_author: String
        parent_permlink: String

        permlink: String
        
        author: String
        author_profile: HiveProfile

        title: String
        body: String
        
        tags: [String]
        image: [String]
        
        app: String
        
        json_metadata: JSON
        
        community_ref: String
        
        children: [MergedPost]

        created_at: String
        updated_at: String

        three_video: JSON

        # Non-essential / arbitrary / TBD
        lang: String
        app_metadata: JSON
        post_type: String


        # Special: Linkage between Off-chain and On-chain mirrors
        refs: [String]
        community: JSON
        parent_post: HivePost
        stats: PostStats
        off_chain_id: String
    }

    union MergedPost = HivePost | CeramicPost

    type FeedOutput {
        parentPost: MergedPost
        items: [MergedPost]
    }

    type CommunityOutput {
        title: String
        description: String
        iamges: ProfileImages
        feed(limit: Int, skip: Int): FeedOutput
    }

    type SyncState {
        blockLag: Int
        syncEtaSeconds: Int
        latestBlockLagDiff: Int
    }

    type LeaderBoardEntry {
        rank: Int
        score: Float
        author: String
        author_profile: MergedProfile
    }

    type LeaderBoard {
        items: [LeaderBoardEntry]
        total_active_creators: Int

    }

    type Query {
        publicFeed(parent_permlink: String, permlink: String, author: String, apps: [String], limit: Int, skip: Int): FeedOutput
        latestFeed(parent_permlink: String, permlink: String, author: String, apps: [String], limit: Int, skip: Int): FeedOutput
        trendingFeed(parent_permlink: String, permlink: String, author: String, apps: [String], limit: Int, skip: Int): FeedOutput
        followingFeed(follower: String, limit: Int, skip: Int): FeedOutput

        socialPost(author: String, permlink: String): MergedPost

        profile(username: String): MergedProfile

        syncState: SyncState

        trendingTags(limit: Int): TrendingTags
        relatedPosts(permlink: String, author: String): FeedOutput
        community(id: String): CommunityOutput
        follows(id: String): FollowOverview
        leaderBoard: LeaderBoard
    }
`
