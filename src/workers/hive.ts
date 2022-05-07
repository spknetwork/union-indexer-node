import { doTypesOverlap } from 'graphql'
import { CONFIG } from '../config'
import { ALLOWED_APPS, detectPostType } from '../services/block_processing/posts'
import { mongo } from '../services/db'
import { fastStream } from '../utils'

void (async () => {
  const db = mongo.db('spk-union-indexer')
  const hiveStreamState = db.collection('hive_stream_state')
  const posts = db.collection('posts')
  const stats = db.collection('stats')
  await mongo.connect()

  const hiveState = await hiveStreamState.findOne({
    id: 'block_height',
  }) || {} as any

  const startTime = new Date()
  const startBlock = hiveState.block_height || CONFIG.threespeak_block_height //30874325;
  const str = await fastStream({
    startBlock: hiveState.block_height || CONFIG.threespeak_block_height,
  })
  let block_height_current = startBlock
  setInterval(async() => {
    const totalTime = (new Date().getTime() - startTime.getTime()) / 1000
    console.table({
      startTime: startTime.toISOString(),
      nowTime: new Date().toISOString(),
      totalTime: totalTime,
      'blocks/s': Number(((block_height_current - startBlock) / totalTime).toFixed()),
      heapUsed: process.memoryUsage().heapUsed
    })
    await stats.findOneAndUpdate({
        key: "stats"
    }, {
        $set: {
            startTime: startTime.toISOString(),
            nowTime: new Date().toISOString(),
            totalTime: totalTime,
            'blocks/s': Number(((block_height_current - startBlock) / totalTime).toFixed()),
        }
    }, {
        upsert: true
    })
  }, 2000)

  str.startStream()

  try {
    for await (let data of str.stream) {
      const [block_height, block] = data as any
      //console.log(block_height)
      block_height_current = block_height

      for (let trx of block.transactions) {
        for (let op of trx.operations) {
          if (op[0] === 'comment') {
            let json_metadata
            let tags
            try {
              json_metadata = JSON.parse(op[1].json_metadata)
              tags = json_metadata.tags
            } catch {
              json_metadata = op[1].json_metadata
            }
            const typye = detectPostType({
              ...op[1],
              json_metadata,
            })
            //console.log(typye)

            //console.log(typye.type)
            //console.log(ALLOWED_APPS.includes(typye.type))
            const { parent_author, parent_permlink, author, permlink } = op[1]

            //Parses posts that belong to a parent of interesting content.
            let allowed_by_parent = false
            if (parent_permlink !== '') {
              const parentPost = await posts.findOne({
                author: parent_author,
                permlink: parent_permlink,
              })
              if (parentPost) {
                allowed_by_parent = true
              }
            }
            //If parent then do not continue
            if (!ALLOWED_APPS.includes(typye.type) && !allowed_by_parent) {
              continue
            }

            const alreadyExisting = await posts.findOne({
              parent_author,
              parent_permlink,
              author,
              permlink,
            })
            if (alreadyExisting) {
              //Ensure state can ONLY go foward
              if (alreadyExisting.state_control.updated_block < block_height) {
                await posts.findOneAndUpdate(alreadyExisting, {
                  $set: {
                    ...op[1],
                    tags,
                    updated_at: new Date(block.timestamp),
                    TYPE: 'HIVE',
                    metadata_status: 'unprocessed'
                  },
                })
              }
            } else {
              //If post does not exist
              try {
                await posts.insertOne({
                  ...op[1],
                  json_metadata,
                  state_control: {
                    block_height: block_height,
                  },
                  tags,
                  created_at: new Date(block.timestamp),
                  updated_at: new Date(block.timestamp),
                  TYPE: 'HIVE',
                  metadata_status: 'unprocessed'
                })
              } catch (ex) {
                console.log(ex)
              }
            }
          }
        }
      }
      await hiveStreamState.findOneAndUpdate(
        {
          id: 'block_height',
        },
        {
          $set: {
            block_height,
          },
        },
        {
            upsert: true
        }
      )
    }
  } catch(ex) {
      console.log(ex)
  }

  console.log('HIT HERE')
  /*setTimeout(() => {
        process.exit(0)
    }, 5000)*/
  process.exit(0)
})()
