import fs from 'fs/promises'
import { HiveClient } from '../utils'
import { mongo } from '../services/db'

void (async () => {
    const db = mongo.db('spk-union-indexer')
    const hiveStreamState = db.collection('hive_stream_state')
    const posts = db.collection('posts')
    const stats = db.collection('stats')
    const notifications = db.collection('notifications')
    const communityDb = db.collection('communities')
    await mongo.connect()

    
    for await(let communityRecord of communityDb.find({
        needs_update: true
    })) {
        try {
            console.log(communityRecord._id.toString().split('/')[1])
            const communityInfo = await HiveClient.call('bridge', 'get_community', {
                name: communityRecord._id.toString().split('/')[1]
            })
            console.log(communityInfo)
            await communityDb.findOneAndUpdate({
                _id: communityRecord._id
            }, {
                $set: {
                    title: communityInfo.title,
                    about: communityInfo.about,
                    lang: communityInfo.lang,
                    is_nsfw: communityInfo.is_nsfw,
                    subscribers: communityInfo.subscribers, //Redo this at some point to be an aggregate function
                    created_at: new Date(communityInfo.created_at),
                    roles: communityInfo.team,
                    needs_update: false
                }
            })
        } catch {

        }

    }

    // for( ; ; ) {
    //     let communities = await HiveClient.call('bridge', 'list_communities', {last})
        
    //     outListFull.push(...communities.map(e => {
    //         return {
    //             ...e,
    //             created_at: new Date(`${e.created_at}.000Z`)
    //         }
    //     }))
    //     if(communities.length === 100) {
    //         last = communities[99].name
    //     } else {
    //         break;
    //     }
    // } 
    // for(let community of outListFull) {
    //     console.log(community)
        
    // }
})()