//@ts-ignore

import { mongo } from '../services/db'
import { createPostStreamID } from '../services/streamBridge'
import { CERAMIC_HOST, fastStream, sleep } from '../utils'


void (async () => {
    const db = mongo.db('spk-union-indexer')
    const hiveStreamState = db.collection('hive_stream_state')
    const posts = db.collection('posts')
    await mongo.connect()
    const { CeramicClient } = await import('@ceramicnetwork/http-client')
    const ceramic = new CeramicClient(CERAMIC_HOST)

    for( ; ; ) {
        let postList = await posts.find({
            needs_stream_id: true,
            offchain_id: {$exists: false},
            TYPE: "HIVE"
        }).toArray()
        for (let post of postList) {
            console.log(post)
            const stream_id = await createPostStreamID({
                author: post.author,
                permlink: post.permlink
            }, ceramic)
            console.log(stream_id)
            await posts.findOneAndUpdate(post, {
                $set: {
                    offchain_id: stream_id,
                    needs_stream_id: false
                }
            })
        }
        await sleep(5000) 
    }
})()
