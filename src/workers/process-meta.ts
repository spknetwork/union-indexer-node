import { extractBase } from '../services/block_processing/base-meta'
import { createNotificationsFromPost } from '../services/block_processing/notifications'
import {mongo} from '../services/db'
import { sleep } from '../utils'

void (async () => {
    const db = mongo.db('spk-union-indexer')
  const hiveStreamState = db.collection('hive_stream_state')
  const posts = db.collection('posts')
  const stats = db.collection('stats')
  const notifications = db.collection('notifications')
  await mongo.connect()
  
  for( ; ; ) {
    const items = await posts.find({
        metadata_status: 'unprocessed'
    })


    for await(let itm of items) {
      const notifs = createNotificationsFromPost(itm as any);
      if(notifs.length > 0) {
        console.log(notifs)
        for(let notify of notifs) {
          const doc = await notifications.findOne(notify) as any;
          if(!doc) {
            await notifications.insertOne(notify)
          }
        }
      }
      const baseMeta = extractBase(itm.body);
      if((baseMeta.tags.length > 0 || baseMeta.urls.length > 0) && !baseMeta.urls.includes("https://www.youtube.com/watch?v=A9QTSyLwd4w"))  {
        //console.log(baseMeta)
      }
    }

    process.exit(0)
  }
})()