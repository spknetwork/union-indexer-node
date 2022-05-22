export const Schema = `
    scalar JSON
    type ProfileImages {
        avatar: String
        background: String
    }
    interface BaseProfile {
        id: String 
        name: String
        description: String

        src: String
    }
    
    type CeramicProfile implements BaseProfile {
        id: String 
        name: String
        description: String

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
        description: String

        images: ProfileImages
        posting_json_metadata: String
        json_metadata: String
        website: String
        location: String

        src: String
    } 

    union MergedProfile = HiveProfile | CeramicProfile


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

    type CeramicPost {
        stream_id: String
        version_id: String
        parent_id: String

        title: String
        body: String

        json_metadata: JSON
        app_metadata: JSON
        debug_metadata: JSON

        author: CeramicProfile
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
        
        children: [HivePost]

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
    }

    union MergedPost = HivePost | CeramicPost

    type FeedOutput {
        items: [MergedPost]
    }

    type Query {
        hello: String
        blog: [HivePost]
        publicFeed(parent_permlink: String, permlink: String, author: String, limit: Int, skip: Int): FeedOutput
        latestFeed(parent_permlink: String, permlink: String, author: String, limit: Int, skip: Int): FeedOutput
        profile(username: String): HiveProfile
    }
`
