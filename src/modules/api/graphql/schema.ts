export const Schema = `
    type Post {
        parent_author: String
        parent_permlink: String

        author: String
        permlink: String

        title: String
        body: String
    }
    type Query {
        hello: String
        blog: [Post]
    }
`
