import { Client } from '@hiveio/dhive'
import { pushable } from 'it-pushable'
import EventEmitter from 'events'
import PQueue from 'p-queue'
const queue = new PQueue({ concurrency: 15 })
let opts = {} as any

//connect to production server
opts.addressPrefix = 'STM'
opts.chainId = 'beeab0de00000000000000000000000000000000000000000000000000000000'

const client = new Client("https://api.deathwing.me")

export function fastStream(startBlock: number) {
  let setSize = 20
  //let startBlock = 42837;
  let endSet = 61767491 - startBlock

  const numbSets = endSet % setSize

  console.log(numbSets)
  console.log(Math.floor(endSet / setSize))

  let processedBlocks = 0

  let currentBlock = startBlock || 1
  const events = new EventEmitter()

  let parser_height = startBlock || 0

  events.on('block', (height) => {
    processedBlocks = processedBlocks + 1
  })

  const blockMap = {}
  /*events.on('block', (height, block) => {
    
    console.log(Object.keys(blockMap))
    if (blockMap[parser_height]) {
      const block_height = parseInt(blockMap[parser_height].block_id.slice(0, 8), 16)
      console.log(`parser_height is ${parser_height}`)
      parser_height = block_height + 1;
      events.emit('block', block_height, blockMap[block_height])
      delete blockMap[block_height]
    }
  })*/
  let activeLength = 0

  setInterval(() => {
    if (blockMap[parser_height]) {
      const block_height = parseInt(blockMap[parser_height].block_id.slice(0, 8), 16)
      
      parser_height = block_height + 1;
      events.emit('block', block_height, blockMap[block_height])
      delete blockMap[block_height]
    }
  }, 1)

  setInterval(() => {
    console.log(`parser_height is ${parser_height}`)
  }, 1000)

  const startStream = async () => {
    for (let x = 1; x <= endSet; x++) {
      activeLength = activeLength + 1
      const streamOpts = {
        from: currentBlock,
        to: currentBlock + setSize - 1,
      }
      currentBlock = currentBlock + setSize
  
      queue.add(() => {
        const stream = client.blockchain.getBlockStream(streamOpts)
        return new Promise((resolve) => {
          stream
            .on('data', async function (block) {
              const block_height = parseInt(block.block_id.slice(0, 8), 16)
              if (parser_height === block_height) {
                parser_height = block_height + 1;
                events.emit('block', block_height, block)
              } else if(block_height > parser_height) {
                blockMap[block_height] = block
              }
            })
            .on('end', function () {
              // done
              activeLength = activeLength - 1
              if (activeLength === 0) {
                //events.emit('end')
              }
              stream.removeAllListeners()
              return resolve(null)
            })
        })
      })
      if(queue.size > 1250) {
        await queue.onEmpty()

      }
    }
  }

  const onDone = async () => {
    await queue.onIdle();
  }

  return {
    events,
    startStream
  }
}
