import { Collection, Db, MongoClient } from 'mongodb'
import { logger } from './common/logger.singleton'

export class CoreService {
    self: CoreService;
    db: Db;
    posts: Collection;
    
    async start() {
        const MONGO_HOST = 'localhost:27017'

        const url = `mongodb://${MONGO_HOST}`
        const mongo = new MongoClient(url)
        await mongo.connect()
        logger.info(`Connected successfully to mongo at ${MONGO_HOST}`)


        this.db = mongo.db('spk-union-indexer')

        this.posts = this.db.collection('posts')
    }
}