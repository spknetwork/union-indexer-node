import { JSONDefinition, DateTypeDefinition } from 'graphql-scalars'

export const Schema = `
    ${JSONDefinition}
    ${DateTypeDefinition}

    ## FEEDS BELOW

    type FeedOutput {
        items: [SocialPost]
    }
    
    type StateControl {
        version_id: String
        height: Int
    }

    type AuthorBase {
        id: String
        username: String
        profile: JSON
    }
    
    type JsonMetadata {
        image: [String]
        app: String
        raw: JSON
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
        
        author: AuthorBase

        stats: PostStats

        json_metadata: JsonMetadata

        children: [MergedPost]

        created_at: Date
        updated_at: Date
    }

    

    type CeramicPost implements SocialPost {
        parent_author: String
        parent_permlink: String
        parent_post: MergedPost

        author: AuthorBase
        permlink: String

        title: String
        body: String

        created_at: Date
        updated_at: Date

        json_metadata: JsonMetadata
        app_metadata: JSON
        debug_metadata: JSON

        stats: PostStats
        
        children: [MergedPost]

        # Same type as HivePost, interchangeable with stream_id
        off_chain_id: String

        #  Ceramic legacy fields
        stream_id: String
        state_control: StateControl
        parent_id: String

        # Access original content on Ceramic
        original_content: JSON
    }

    type HivePost implements SocialPost {
        parent_author: String
        parent_permlink: String
        parent_post: MergedPost

        author: AuthorBase
        permlink: String

        title: String
        body: String
        
        tags: [String]
        
        json_metadata: JsonMetadata
        
        community: JSON # Create schema
        
        children: [MergedPost]

        created_at: Date
        updated_at: Date

        spkvideo: JSON

        # Non-essential / arbitrary / TBD
        lang: String
        app_metadata: JSON
        post_type: String

        flags: [String]


        # Special: Linkage between Off-chain and On-chain mirrors
        refs: [String]
        stats: PostStats
        off_chain_id: String
    }

    union MergedPost = HivePost | CeramicPost

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
        json_metadata: JSON
        website: String
        location: String
        did: String

        src: String
    } 

    union MergedProfile = HiveProfile | CeramicProfile

    type TrendingTag {
        tag: String
        score: Int
    }

    type TrendingTags {
        tags: [TrendingTag]
    }


    type CommunityRole {
        username: String
        role: String
        title: String
    }

    type CommunityOutput {
        title: String
        # Communities can have both about and description
        # About is usually a short summary
        about: String
        description: String 
        subscribers: Int

        created_at: String
        lang: String
        is_nsfw: Boolean
        roles: [CommunityRole]

        images: ProfileImages

        socialFeed(spkvideo: SpkVideoQuery, apps: WhereField, pagination: PaginationOptions, feedOptions: FeedOptions): FeedOutput
    }

    type SyncState {
        blockLag: Int
        syncEtaSeconds: Int
        latestBlockLagDiff: Int
    }

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

    input WhereField {
        _regex: String
        _eq: String
        _ne: String
        _lt: Int
        _gt: Int
        _lte: Int
        _gte: Int
        #_and: JSON
        _in: [String!]
        _nin: [String!]
    }

    input SpkVideoQuery {
        firstUpload: Boolean
        only: Boolean
        isShort: Boolean
    }

    
    input PaginationOptions {
        limit: Int
        skip: Int
    }

    input FeedOptions {
        includeComments: Boolean
        includeCeramic: Boolean
        byFollower: WhereField #Skip resolver for now
        byTag: WhereField
        byCreator: WhereField
        # Parent permlink
        byPermlink: WhereField
        byCommunity: WhereField
        byApp: WhereField
        byType: WhereField
    }

    type Query {
        # Latest feed of content
        socialFeed(spkvideo: SpkVideoQuery, apps: WhereField, pagination: PaginationOptions, feedOptions: FeedOptions): FeedOutput
        trendingFeed(spkvideo: SpkVideoQuery, apps: WhereField, pagination: PaginationOptions, feedOptions: FeedOptions): FeedOutput

        relatedFeed(pagination: PaginationOptions): FeedOutput

        profile(id: String): MergedProfile

        syncState: SyncState
        
        trendingTags(limit: Int): TrendingTags

        community(id: String): CommunityOutput

        follows(id: String): FollowOverview
        leaderBoard: LeaderBoard

    }
`