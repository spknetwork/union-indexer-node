import EventEmitter from 'events'
//import PQueue from 'p-queue'
import { BlockchainMode, BlockchainStreamOptions, Client } from '@hiveio/dhive'
import Pushable from 'it-pushable'

export const HiveClient = new Client(process.env.HIVE_HOST?.split(',') || ["https://hive-api.3speak.tv", 'https://anyx.io'])

export const OFFCHAIN_HOST = process.env.OFFCHAIN_HOST || "https://us-01.infra.3speak.tv/v1/graphql"

export const CERAMIC_HOST = process.env.CERAMIC_HOST || "https://ceramic.us-02.infra.3speak.tv"

export async function fastStream(streamOpts: {startBlock: number, endBlock?: number}) {
    const PQueue = (await import('p-queue')).default
    const starting_concurency = 5;
    const target_concurrency = 120;
    const queue = new PQueue({ concurrency: starting_concurency })
    if(!streamOpts.endBlock) {
        const currentBlock = await HiveClient.blockchain.getCurrentBlock()
        const block_height = parseInt(currentBlock.block_id.slice(0, 8), 16)
        streamOpts.endBlock = block_height;
    }
    let setSize = 8
    //let startBlock = 42837;
    //Use 30874325 in the state store (database) to parse from the beginning of 3speak
    let endSet = (streamOpts.endBlock - streamOpts.startBlock) / setSize
  
    /*const numbSets = endSet % setSize
  
    console.log(numbSets)
    console.log(Math.floor(endSet / setSize))*/
  
  
    let currentBlock = streamOpts.startBlock || 1
    const events = new EventEmitter()
    const streamOut = Pushable()
    let streamPaused = false;
  
    let parser_height = streamOpts.startBlock || 0
  

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
  
    const eventQueue = setInterval(() => {
      if (blockMap[parser_height]) {
        const block_height = parseInt(blockMap[parser_height].block_id.slice(0, 8), 16)
        
        parser_height = block_height + 1;
        events.emit('block', block_height, blockMap[block_height])
        delete blockMap[block_height]
      }
      for(let key of Object.keys(blockMap)) {
        if(Number(key) < parser_height) {
          delete blockMap[key]; //Memory safety
        }
      }
    }, 1)

    setInterval(() => {
      if(queue.concurrency < target_concurrency) {
        queue.concurrency = queue.concurrency + 1;
      }
    }, 1000)
  
    const startStream = async () => {
      let finalBlock;
      for (let x = 1; x <= endSet; x++) {
        activeLength = activeLength + 1
        const streamOptsInput:BlockchainStreamOptions = {
          from: currentBlock,
          to: currentBlock + setSize - 1,
          mode: BlockchainMode.Latest
        }
        currentBlock = currentBlock + setSize

        finalBlock = streamOptsInput.to;
        queue.add(() => {
          const stream = HiveClient.blockchain.getBlockStream(streamOptsInput)
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
              .on('error', (error) => {
                clearInterval(eventQueue)
                console.log('error is', error)
                streamOut.end(error)
              })
              .on('end', function () {
                // done
                activeLength = activeLength - 1
                if (activeLength === 0) {
                  //events.emit('end')
                }
                ;(stream as any).end();
                stream.removeAllListeners()
                return resolve(null)
              })
          })
        })
        if(queue.pending === queue.concurrency && queue.size > 600) {
          await queue.onSizeLessThan(240)
        }
        if(streamPaused === true) {
          queue.pause()
          await new Promise(async (resolve) => {
            events.once("unpause", () => {
              resolve(null)
              queue.start()
            })
          })
        }
      }
      await queue.onIdle();
      console.log("ITS IDLE")
      const finalStream = HiveClient.blockchain.getBlockStream({
          from: finalBlock,
          mode: BlockchainMode.Latest
      })
      await new Promise((resolve) => {
        finalStream
          .on('data', async function (block) {
            const block_height = parseInt(block.block_id.slice(0, 8), 16)
            if (parser_height === block_height) {
              parser_height = block_height + 1;
              events.emit('block', block_height, block)
            } else if(block_height > parser_height) {
              blockMap[block_height] = block
            }
          })
          .on('error', (error) => {
            clearInterval(eventQueue)
            streamOut.end(error)
          })
          .on('end', function () {
            // done
            activeLength = activeLength - 1
            if (activeLength === 0) {
              //events.emit('end')
            }
            finalStream.removeAllListeners()
            return resolve(null)
          })
      })
    }
  
    const onDone = async () => {
      await queue.onIdle();
    }
    
    const resumeStream = async () => {
      streamPaused = false
      events.emit('unpause')
    }
    
    const stopStream = async () => {
      streamPaused = true
    }

    events.on('block', (block_height, block) => {
        streamOut.push([block_height, block])
    })    
  
    const debugFetch = () => {
      return {
        parser_height,
        queue,
        blockMapSize: Object.keys(blockMap).length
      }  
    }


    return {
      events,
      startStream,
      resumeStream,
      stopStream,
      onDone,
      stream: streamOut,
      debugFetch
    }
  }

export function sleep(ms: number) {
 return new Promise(resolve => setTimeout(resolve, ms));
}
  

export const NULL_DID = 'did:key:z6MkeTG3bFFSLYVU7VqhgZxqr6YzpaGrQtFMh1uvqGy1vDnP' // Null address should go to an empty ed25519 key

export function obj_set(obj, props, value) {
  if (typeof props == 'string') {
    props = props.split('.')
  }
  if (typeof props == 'symbol') {
    props = [props]
  }
  var lastProp = props.pop()
  if (!lastProp) {
    return false
  }
  var thisProp
  while ((thisProp = props.shift())) {
    if (typeof obj[thisProp] == 'undefined') {
      obj[thisProp] = {}
    }
    obj = obj[thisProp]
    if (!obj || typeof obj != 'object') {
      return false
    }
  }
  obj[lastProp] = value
  return true
}