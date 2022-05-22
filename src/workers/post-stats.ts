import { mongo } from '../services/db'
import { HiveClient, sleep } from '../utils'

/**
 * Calculates aggregate number of comments, views, votes, etc of posts on the backend
 *
 */

void (async () => {
  const db = mongo.db('spk-union-indexer')
  const hiveStreamState = db.collection('hive_stream_state')
  const posts = db.collection('posts')
  const stats = db.collection('stats')
  const notifications = db.collection('notifications')
  await mongo.connect()

  const PQueue = (await import('p-queue')).default
  const queue = new PQueue({ concurrency: 50 })

  for (;;) {
    const items = await posts.find({
      metadata_status: 'unprocessed',
    })

    for await (let itm of items) {
      queue.add(async () => {
        //console.log(itm)

        let total_reward = null
        let total_votes = 0
        if (itm.TYPE === 'HIVE') {
          try {
            const data = await HiveClient.call('condenser_api', 'get_content', [
              itm.author,
              itm.permlink,
            ])
            total_reward =
              Number(data.total_payout_value.split(' ')[0]) +
              Number(data.curator_payout_value.split(' ')[0])

            total_votes = data.net_votes
          } catch {}
        }

        const num_comments = await posts.countDocuments({
          parent_author: itm.author,
          parent_permlink: itm.permlink,
        })

        await posts.findOneAndUpdate(itm, {
          $set: {
            'stats.num_comments': num_comments,
            'stats.num_votes': total_votes,
            'stats.total_hive_reward': total_reward,
          },
        })
      })
      await queue.onSizeLessThan(2500)
    }
    await queue.onIdle()

    process.exit(0)
  }
})()
