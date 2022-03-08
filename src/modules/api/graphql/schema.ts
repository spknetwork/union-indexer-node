export const Schema = `
    type HivePost {
        parent_author: String
        parent_permlink: String

        author: String
        permlink: String

        title: String
        body: String
        tags: [String]

        json_metadata: String
    }
    type Query {
        hello: String
        blog: [Post]
    }
`
