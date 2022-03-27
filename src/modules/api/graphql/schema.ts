export const Schema = `

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
    
    type HivePost {
        parent_author: String
        parent_permlink: String

        permlink: String

        stream_id: String
        version_id: String
        parent_id: String

        title: String
        body: String
        category: String
        
        refs: [String]
        tags: [String]
        image: [String]
        lang: String

        post_type: String
        app: String

        json_metadata: String
        app_metadata: String
        community_ref: String

        children: [HivePost]
        author: CeramicProfile

        data_type: String
    }
    type Query {
        hello: String
        blog: [HivePost]
        publicFeed(parent_permlink: String): [HivePost]
    }
`
