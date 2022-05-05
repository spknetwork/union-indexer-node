import { Client } from '@hiveio/dhive'
import { MongoClient } from 'mongodb'
import { fastStream } from './fastStreaming'
import { ALLOWED_APPS, detectPostType } from './services/block_processing/posts'

let opts = {} as any

//connect to production server
opts.addressPrefix = 'STM'
opts.chainId = 'beeab0de00000000000000000000000000000000000000000000000000000000'

//connect to server which is connected to the network/production
const func = async () => {
  const dbClient = new MongoClient('mongodb://127.0.0.1:27017')
  await dbClient.connect()
  const db = dbClient.db('spk-union-indexer')
  const posts = db.collection('posts')
  const blocks = db.collection('blocks')
  const hiveStreamState = db.collection('hive_stream_state')

  const client = new Client('https://api.deathwing.me')

  const hiveState = await hiveStreamState.findOne({
    id: 'block_height',
  })

  let blockHeight
  if (!hiveState) {
    blockHeight = 1
  } else {
    blockHeight = hiveState.block_height
  }
  const { events, startStream } = fastStream(blockHeight)

  //await posts.deleteMany({})
  /*await blocks.createIndex({
    block_id: -1
  })*/
  let currentBlock = blockHeight
  let timestamp
  setInterval(() => {
    console.log(`latest block: ${currentBlock}; ${timestamp}`)
  }, 1000)
  setTimeout(() => {
    process.exit(0)
  }, 1800 * 1000) // Stop in 1800 seconds aka 30 minutes

  events
    .on('block', async function (block_height, block) {
      block.block_height = block_height
      timestamp = block.timestamp

      await hiveStreamState.findOneAndUpdate({
        id: 'block_height'
      }, {
        $set: {
            block_height: block.block_height
        }
    })
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
            console.log(typye)


            console.log(typye.type)
            console.log(ALLOWED_APPS.includes(typye.type))
            const { parent_author, parent_permlink, author, permlink } = op[1]

            //Parses posts that belong to a parent of interesting content. 
            let allowed_by_parent = false
            if(parent_permlink !== '') {
              const parentPost = await posts.findOne({
                author: parent_author,
                permlink: parent_permlink,
              })
              if(parentPost) {
                allowed_by_parent = true;
              }
            }
            //If parent then do not continue
            if(!ALLOWED_APPS.includes(typye.type) && !allowed_by_parent) {
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
              if (alreadyExisting.state_control.updated_block < block.block_height) {
                await posts.findOneAndUpdate(alreadyExisting, {
                  $set: {
                    ...op[1],
                    tags,
                    updated_at: new Date(block.timestamp),
                    TYPE: 'HIVE'
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
                    block_height: block.block_height,
                  },
                  tags,
                  created_at: new Date(block.timestamp),
                  updated_at: new Date(block.timestamp),
                  TYPE: 'HIVE'
                })
              } catch (ex) {
                console.log(ex)
              }
            }
          }
        }
      }
      
    })
    .on('end', function () {
      // done
      console.log('END')
    })
  await startStream()
}
void (async () => {
  try {
    await func()
  } catch (ex) {
    console.log('ERROR CAUGHT!')
    console.log(ex)
  }
})()
let tries = 0
/*process.on('unhandledRejection', (error: Error) => {
    console.log('unhandledRejection', error.message)
    tries = tries + 1
    if(tries < 100) {
        func()
    } else {
        process.exit(0)
    }
})*/
