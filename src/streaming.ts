import { Client } from '@hiveio/dhive'
import { MongoClient } from 'mongodb'
import { detectPostType } from './services/block_processing/posts'

let opts = {} as any

//connect to production server
opts.addressPrefix = 'STM'
opts.chainId = 'beeab0de00000000000000000000000000000000000000000000000000000000'

//connect to server which is connected to the network/production
void (async () => {
  const dbClient = new MongoClient('mongodb://127.0.0.1:27017')
  await dbClient.connect()
  const db = dbClient.db('spk-union-indexer')
  const posts = db.collection('posts')
  const hiveStreamState = db.collection('hive_stream_state')

  
  const client = new Client('https://api.deathwing.me')


  const hiveState = await hiveStreamState.findOne({
    id: "block_height"
  })
  let blockHeight;
  if(!hiveState) {
    blockHeight = 1;
  } else {
    blockHeight = hiveState.block_height;
  }
  const stream = client.blockchain.getBlockStream({
    //from: 32563683,
    //from: 32564032,
    // from: 33564114,
    from: blockHeight,
    
  })

  //await posts.deleteMany({})
  let currentBlock = blockHeight;
  stream
    .on('data', async function (block) {
      
      for (let trx of block.transactions) {
        for (let op of trx.operations) {
          if (op[0] === 'comment') {
            let json_metadata;
            try {
                json_metadata = JSON.parse(op[1].json_metadata);
            } catch {
                json_metadata = op[1].json_metadata
            }
            const typye = detectPostType({
              ...op[1],
              json_metadata
            })
            
            posts.insertOne({
                ...op[1],
                json_metadata
            })
          }
        }
      }
      console.log(`Done processing block: ${block.block_id}; ${currentBlock}`)
      if(block.transactions[0]) {
        currentBlock = block.transactions[0].block_num
      } else {
        currentBlock = currentBlock + 1;
      }
      await hiveStreamState.findOneAndUpdate({
        id: "block_height"
      }, {
        $set: {
          block_height: currentBlock || 1
        }
      }, {
        upsert: true
      })
    })
    .on('end', function () {
      // done
      console.log('END')
    })
})()
