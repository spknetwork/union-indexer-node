import GraphQLJSON from 'graphql-type-json'
import { indexerContainer } from ".."

export class Post {
    rawDoc: any;

    constructor(rawDoc: any) {
        this.rawDoc = rawDoc;
    }

    get parent_author() {
        return this.rawDoc.parent_author;
    }

    get parent_permlink() {
        return this.rawDoc.parent_permlink;
    }

    get permlink() {
        return this.rawDoc.permlink;
    }

    get stream_id() {
        return this.rawDoc.stream_id;
    }

    get version_id() {
        return this.rawDoc.version_id;
    }

    get parent_id() {
        return this.rawDoc.parent_id;
    }

    get title() {
        return this.rawDoc.title;
    }

    get body() {
        return this.rawDoc.body;
    }

    get category() {
        return this.rawDoc.category;
    }

    get refs() {
        return this.rawDoc.refs;
    }

    get tags() {
        return this.rawDoc.json_metadata.tags;
    }

    get image() {
        return this.rawDoc.json_metadata.image;
    }
    
    async author() {

    }

    async children(args) {
        return await indexerContainer.self.posts.find({
            parent_permlink: this.rawDoc.permlink,
            
        }, {
            limit: args.limit || 100,
            skip: args.skip,
        }).toArray()
    }
}

export const Resolvers = {
    JSON: GraphQLJSON,
    async publicFeed (args: any) {
        const mongodbQuery = {};
        if(args.parent_permlink) {
            mongodbQuery['parent_permlink'] = args.parent_permlink
        }
        if(args.author) {
            mongodbQuery['author'] = args.author
        }
        if(args.permlink) {
            mongodbQuery['permlink'] = args.permlink
        }
        return (await indexerContainer.self.posts.find(mongodbQuery, {
            limit: args.limit || 100,
            skip: args.skip
        }).toArray()).map(e => new Post(e))
    }
}