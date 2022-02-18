import { Client } from '@hiveio/dhive'
import { MongoClient } from 'mongodb'
import { fastStream } from './fastStreaming'
import { detectPostType } from './services/block_processing/posts'

let opts = {} as any

//connect to production server
opts.addressPrefix = 'STM'
opts.chainId = 'beeab0de00000000000000000000000000000000000000000000000000000000'

//connect to server which is connected to the network/production
const func = (async () => {
  const dbClient = new MongoClient('mongodb://127.0.0.1:27017')
  await dbClient.connect()
  const db = dbClient.db('spk-union-indexer')
  const posts = db.collection('posts')
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
  let currentBlock = blockHeight
  let timestamp
  setInterval(() => {
    console.log(`latest block: ${currentBlock}; ${timestamp}`)
  }, 1000)
  events
    .on('block', async function (block_height, block) {
      const block_height2 = parseInt(block.block_id.slice(0, 8), 16)
      //console.log(`Start processing block: ${block.block_id}; ${currentBlock}/${block_height2} ${block.timestamp}`)
      timestamp = block.timestamp

      for (let trx of block.transactions) {
        for (let op of trx.operations) {
          if (op[0] === 'comment') {
            let json_metadata
            try {
              json_metadata = JSON.parse(op[1].json_metadata)
            } catch {
              json_metadata = op[1].json_metadata
            }
            const typye = detectPostType({
              ...op[1],
              json_metadata,
            })
            console.log(typye)

            posts.insertOne({
              ...op[1],
              json_metadata,
            })
          }
        }
      }

      if (block.transactions[0]) {
        currentBlock = block.transactions[0].block_num
      } else {
        currentBlock = currentBlock + 1
      }
      await hiveStreamState.findOneAndUpdate(
        {
          id: 'block_height',
        },
        {
          $set: {
            block_height: currentBlock || 1,
          },
        },
        {
          upsert: true,
        },
      )
    })
    .on('end', function () {
      // done
      console.log('END')
    })
  await startStream()
})
void (async () => {
    try {
        await func();
    } catch (ex) {
        console.log("ERROR CAUGHT!")
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
