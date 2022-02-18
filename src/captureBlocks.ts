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
  const blocks = db.collection('blocks')
  const hiveStreamState = db.collection('hive_stream_state')

  const client = new Client('https://api.deathwing.me')

  const hiveState = await hiveStreamState.findOne({
    id: 'block_height',
  })
  let blockHeight = 1;
 /* if (!hiveState) {
    blockHeight = 1
  } else {
    blockHeight = hiveState.block_height
  }*/
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
  events
    .on('block', async function (block_height, block) {
        console.log(block_height, block)
        block.block_height = block_height;
        timestamp = block.timestamp
        
        await blocks.insertOne(block)
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
