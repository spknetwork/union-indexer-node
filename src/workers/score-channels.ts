import fs from 'fs/promises'
import { HiveClient } from '../utils'
import { mongo } from '../services/db'
import moment from 'moment'

void (async () => {
  const db = mongo.db('spk-union-indexer')
  const hiveStreamState = db.collection('hive_stream_state')
  const posts = db.collection('posts')
  const stats = db.collection('stats')
  const profilesDb = db.collection('profiles')
  const notifications = db.collection('notifications')
  const communityDb = db.collection('communities')
  await mongo.connect()

  // for (let creator of await posts.distinct('author', {
  //   'json_metadata.app': { $regex: '3speak/' },
  // })) {
  //   // console.log(creator)
  // }

  const activeCreators = []

  const videosAll = await posts
    .aggregate([
      {
        $match: {
          //   status: 'published'
          //   created_at: {
          //     // $gt: moment().subtract('1', 'month')
          //   },
          'json_metadata.app': { $regex: '3speak/' },
        },
      },
      {
        $project: {
          author: 1,
          _id: 1,
        },
      },
      {
        $group: {
          _id: null,
          author: { $addToSet: '$author' },
        },
      },
    ])
    .toArray()
  console.log(videosAll)

  for (let author of videosAll[0].author) {
    // console.log(creator)
    const videos = await posts.find({
    //   created_: { $gt: moment().subtract('1', 'month') },
      author: author,
      'json_metadata.app': { $regex: '3speak/' },
    })

    let totalComments = 0;
    let totalVotes = 0;
    for await (let vid of videos) {
    //   console.log(vid)
      const firstLevelComments = await posts.countDocuments({
        parent_author: vid.author,
        parent_permlink: vid.permlink,
      })

      totalVotes = totalVotes + vid.stats?.num_votes || 0;

      //TODO: Do recursive comments
      totalComments = totalComments + firstLevelComments
    }
    // console.log(totalComments / (totalVotes || 1))
    const score = (totalComments * 3) + (totalVotes * 0.1)
    if(score > 0) {
        activeCreators.push(author)
        await profilesDb.findOneAndUpdate({
            username: author
        }, {
            $set: {
                score
            }
        })
    }
  }
  await profilesDb.updateMany({
    username: {
      $nin: activeCreators
    }
  }, {
    $set: {
        score: 0
    }
  })
  process.exit(0)
})()
