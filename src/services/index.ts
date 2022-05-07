import { Collection, Db, MongoClient } from 'mongodb'
import { logger } from './common/logger.singleton'
import {MONGODB_URL} from './db'

export class CoreService {
    self: CoreService;
    db: Db;
    posts: Collection;
    streamState: Collection;
    
    async start() {
        const url = MONGODB_URL
        const mongo = new MongoClient(url)
        await mongo.connect()
        logger.info(`Connected successfully to mongo at ${MONGODB_URL}`)


        this.db = mongo.db('spk-union-indexer')

        this.posts = this.db.collection('posts')
        this.streamState = this.db.collection('stream_state')

        await this.streamState.createIndex({
            key: 1
        }, {
            unique: true
        })
    }
}