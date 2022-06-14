import { Collection, Db, MongoClient } from 'mongodb'
import { CERAMIC_HOST } from '../utils';
import { logger } from './common/logger.singleton'
import {MONGODB_URL} from './db'

export class CoreService {
    self: CoreService;
    db: Db;
    posts: Collection;
    streamState: Collection;
    ceramic: any;
    
    async start() {
        const url = MONGODB_URL
        const mongo = new MongoClient(url)
        await mongo.connect()
        logger.info(`Connected successfully to mongo at ${MONGODB_URL}`)


        this.db = mongo.db('spk-union-indexer')

        this.posts = this.db.collection('posts')
        this.streamState = this.db.collection('stream_state')

        //We still need to use Ceramic on the union indexer a small amount. 
        // However, any Ceramic heavy operations should utilize the offchain indexer.
        const { CeramicClient } = await import('@ceramicnetwork/http-client')
      
        this.ceramic = new CeramicClient(CERAMIC_HOST)
        

        try {
            await this.streamState.createIndex({
                key: 1
            }, {
                unique: true
            })
        } catch {

        }
        
        try  {
            await this.posts.createIndex({
                author: 1,
                permlink: 1
            })
        } catch {

        }
        try  {
            await this.posts.createIndex({
                parent_permlink: 1
            })
        } catch {

        }
        try  {
            await this.posts.createIndex({
                "json_metadata.app": 1,
                created_at: -1
            })
        } catch {

        }
        try  {
            await this.posts.createIndex({
                "stats.num_comments": -1,
            })
        } catch {

        }
        try  {
            await this.posts.createIndex({
                "tags": 1,
            })
        } catch {

        }
        try  {
            await this.posts.createIndex({
                "permlink": 1,
            })
        } catch {

        }
    }
}