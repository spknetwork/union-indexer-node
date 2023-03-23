import { CONFIG } from '../config'
import { ALLOWED_APPS, detectPostType } from '../services/block_processing/posts'
import { mongo } from '../services/db'
import { fastStream, HiveClient, obj_set } from '../utils'
import DiffMatchPatch from '@2toad/diff-match-patch'
import Moment from 'moment'
import { AnyBulkWriteOperation, Document } from 'mongodb'
import url from 'url'
import { DelegatedAuthority } from '../types/index'
import { PostStruct } from '../types/posts'



function pulloutIpfsLinks(json_metadata) {
  let ipfs_links = []
  let source_map = []
  if(json_metadata?.video?.info?.sourceMap) {
    json_metadata?.video?.info?.sourceMap.forEach(e => {
      ipfs_links.push({
        cid: new url.URL(e.url).host
      })
      source_map.push(e)
    })
  }

  return {
    ipfs_links,
    source_map
  }
}

void (async () => {
  
  

  const db = mongo.db('spk-union-indexer')
  const hiveStreamState = db.collection('hive_stream_state')
  const posts = db.collection<PostStruct>('posts')
  const stats = db.collection('stats')
  const hiveProfiles = db.collection('profiles')
  const followsDb = db.collection('follows')
  const communityDb = db.collection('communities')
  const delegatedAuthorityDb = db.collection<DelegatedAuthority>('delegated-authority')
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
    if(process.memoryUsage().heapUsed > 400000 * 1000) {
      //Safety to prevent buffer overflow
      console.log("HIT SOFT MEMORY LIMIT: PAUSING")
      str.stopStream()
    }
    if(process.memoryUsage().heapUsed < 300000 * 1000) {
      //Safety to prevent buffer overflow
      str.resumeStream()
    }
    if(process.memoryUsage().heapUsed > 800000 * 1000) {
      //Safety to prevent buffer overflow
      console.log("HIT MEMORY LIMIT: STOPPING")
      process.exit(0)
    }
    // process.mem
    await stats.findOneAndUpdate({
        key: "stats"
    }, {
        $set: {
            startTime: startTime.toISOString(),
            nowTime: new Date().toISOString(),
            totalTime: totalTime,
            'blocks/s': Number(((block_height_current - startBlock) / totalTime).toFixed()),
            heapUsed: process.memoryUsage().heapUsed,
            block_height_current,
        }
    }, {
        upsert: true
    })
  }, 2000)

  setInterval(async () => {
    try {
      const blockHeight = await HiveClient.blockchain.getCurrentBlockNum()
      const statsCurrent = await stats.findOne({
        key: "stats"
      })
      //Block lag should always be getting smaller if we are catching up. 
      const blockLag = blockHeight - statsCurrent.block_height_current
      const blockEta = blockLag / statsCurrent['blocks/s']
      const tableObj = {
        blockHeight,
        blockLag,
        blockLagDiff: blockLag - statsCurrent.blockLag, //This value should be negative if we are catching up. If it's consistently going up then there is a problem
        blockEta: Moment.duration(blockEta, 'seconds').humanize(true),
        blockEtaSeconds: blockEta,
        blockEtaDate: Moment().add(blockEta, 'seconds').toISOString()
      }
      console.table(tableObj)
      await stats.findOneAndUpdate({
        key: "stats"
      }, {
        $set: {
          blockLag: tableObj.blockLag,
          syncEtaSeconds: Math.round(blockEta),
          blockLagDiff: blockLag - statsCurrent.blockLag,
        }
      })

    } catch(ex) {
      console.log(ex)
    }
  }, 30 * 1000) //60s

  str.startStream()
  let last_time;

  let transactionsProcessed = 0; 
  let busy = false
  let lastStart
  let lastFinish
  let blockMS
  let blockMSTotal = 0;
  let blockMSCount = 0;


  

  setInterval(async() => {
    const debug = str.debugFetch()
    console.log('processed ', transactionsProcessed, busy, {
      blockMS,
      avgBlockMS: Math.round(blockMSTotal / blockMSCount),
      blockMSCount,
      BH: debug.parser_height,
      idleThreads: debug.queue.pending,
      blockMapSize: debug.blockMapSize,
    })
    transactionsProcessed = 0
    blockMSTotal = 0;
    blockMSCount = 0;

    
  }, 1000)
  
  let bulkWritePosts:Array<AnyBulkWriteOperation<Document>> = []
  let bulkWriteFollows:Array<AnyBulkWriteOperation<Document>> = []
  let bulkWriteProfiles:Array<AnyBulkWriteOperation<Document>> = []

  setInterval(async () => {
    // try {
    //   if (postsBulkWrite.batches.length > 0) {
    //     // console.log(postsBulkWrite.batches[0].operations, postsBulkWrite.batches.length)
    //     await postsBulkWrite.execute()
    //   }
    // } catch (ex) {
    //   console.log(ex)
    // }
    // postsBulkWrite = posts.initializeUnorderedBulkOp()
    console.log("RUNNING BULK WRITE")
    if(bulkWritePosts.length > 0) {
      const postsPromise = posts.bulkWrite(bulkWritePosts as any)
      
      bulkWritePosts = []
  
      await postsPromise;
    }

    await hiveStreamState.findOneAndUpdate(
      {
        id: 'block_height',
      },
      {
        $set: {
          block_height: block_height_current,
          last_time,
        },
      },
      {
          upsert: true
      }
    )
  }, 2 * 1000)
  try {
    for await (let data of str.stream) {
      const [block_height, block] = data as any
      //console.log(block_height)
      block_height_current = block_height

      try {
        last_time = new Date(block.timestamp);
      } catch(ex) {
        console.log(block)
        throw ex
      }
      transactionsProcessed = transactionsProcessed + block.transactions.length
      busy = true
      lastStart = new Date()


      let postsBulkWrite = posts.initializeUnorderedBulkOp()
      
      await Promise.all(block.transactions.map(async (tx: any) => {
        // if(tx) {
        //   return;
        // }
       
        for (let op of tx.operations) {
          try {
            if(op[0] === "vote") {
              const vote_op = op[1]
              bulkWritePosts.push({
                updateOne: {
                  filter: {
                    author: vote_op.author,
                    permlink: vote_op.permlink,
                  },
                  update: {
                    $set: {
                      need_stat_update: true
                    }
                  }
                }
              })
              // const post = await posts.findOne({
              //   author: vote_op.author,
              //   permlink: vote_op.permlink,
              // })
              // postsBulkWrite.find({
              //   author: vote_op.author,
              //   permlink: vote_op.permlink,
              // }).updateOne({
              //   $set: {
              //     need_stat_update: true
              //   }
              // })
              // if(post) {
              //   await posts.findOneAndUpdate({
              //     _id: post._id
              //   }, {
              //     $set: {
              //       need_stat_update: true
              //     }
              //   })
              // }
            }
            if(op[0] === "custom_json") {
              const {id, json: json_raw} = op[1];
              
              if(id === "spk.bridge_id") {
                const json = JSON.parse(json_raw)
                console.log(json, id)
                
                const post = await posts.findOne({
                  author: json.author,
                  permlink: json.permlink
                })
                if(post) {
                  await posts.findOneAndUpdate({
                    _id: post._id
                  }, {
                    $set: {
                      needs_stream_id: true
                    }
                  })
                }
              }
              if(id === "community") {
                const json = JSON.parse(json_raw)
  
                const account = op[1].required_posting_auths[0]
                
                if(json[0] === "subscribe") { 
                  try {
                    await followsDb.findOneAndUpdate({
                      _id: `hive-${account}-${json[1].community}`
                    }, {
                      $set: {
                        follower: account,
                        following: json[1].community,
                        what: 'community',
                        followed_at: new Date(block.timestamp)
                      }
                    }, {
                      upsert: true,
                      retryWrites: true
                    })
                  } catch {
  
                  }
                }
                if(json[0] === "unsubscribe") {
                  await followsDb.findOneAndDelete({
                    _id: `hive-${account}-${json[1].community}`
                  })
                }
                if(json[0] === "updateProps") {
                  await communityDb.findOneAndUpdate({
                    _id: `hive/${account}`
                  }, {
                    $set: {
                      title: json[1].title,
                      about: json[1].about,
                      needs_update: true
                    }
                  }, {
                    upsert: true
                  })
                }
              }
              if(id === "spk.follow") {
                //TODO: Implement spk following of offchain accounts
              }
              if(id === "spk.unfollow") {
                
              }
              if(id === 'follow') {
                let json
                try {
                  json = JSON.parse(json_raw)
                } catch {
                  continue;
                }
                if(json[0] === "follow") {
                  const account = op[1].required_posting_auths[0]
                  if(account !== json[1].follower) {
                    continue;
                  }
                  const followed = json[1].what.length >= 1
                  if(followed) {
                    try {
                      await followsDb.findOneAndUpdate({
                        _id: `hive-${json[1].follower}-${json[1].following}`
                      }, {
                        $set: {
                          follower: json[1].follower,
                          following: json[1].following,
                          what: json[1].what,
                          followed_at: new Date(block.timestamp)
                        }
                      }, {
                        upsert: true,
                        retryWrites: true
                      })
                    } catch {
  
                    }
                  } else {
                    await followsDb.findOneAndDelete({
                      _id: `hive-${json[1].follower}-${json[1].following}`
                    })
                  }
                }
              }
            }
            if(op[0] === "account_update") {
              const updateOp = op[1]
              if(updateOp.posting) {
                if(updateOp.posting.account_auths) {
                  const auths = await delegatedAuthorityDb.find({
                    to: op[1].account
                  }).toArray()
                  for(let auth of auths) {{
                    if(!updateOp.posting.account_auth.find(e => {
                      if(CONFIG.delegated_posting_accounts[0] === "*") {
                        return true;
                      }
                      return CONFIG.delegated_posting_accounts.includes(e.to) 
                    })) {
                      console.log('Deleting posting auth')
                      //Need to delete the posting auth
                      await delegatedAuthorityDb.deleteOne({
                        type: "posting",
                        to: auth[0],
                        from: updateOp.account,
                      })
                    }
                  }}
  
                  //Add posting auth to DB
                  for(let auth of updateOp.posting.account_auths) {
                    if(CONFIG.delegated_posting_accounts.includes(auth[0]) || CONFIG.delegated_posting_accounts[0] === "*") {
                      //Add
                      await delegatedAuthorityDb.findOneAndUpdate({
                        type: "posting",
                        to: auth[0],
                        from: updateOp.account,
                      }, {
                        $set: {
                          type: "posting",
                          to: auth[0],
                          from: updateOp.account,
                          block_height: block_height,
                          trx_id: tx.transaction_id,
                          date: new Date(block.timestamp)
                        }
                      }, {
                        upsert: true
                      })
                    }
                  }
                }
              }
            }
            if(op[0] === 'account_update2') {
              const profileData = op[1]
              const posting_json_metadata = JSON.parse(profileData.posting_json_metadata)
              // console.log('baden baden', posting_json_metadata)
              // console.log(tx.operations, tx)
              if(!posting_json_metadata.profile) {
                continue;
              }
              if(profileData.account.startsWith('hive-')) {
                await communityDb.findOneAndUpdate({
                  _id: `hive/${profileData.account}`
                }, {
                  $set: {
                    username: profileData.account,
                    TYPE: "HIVE",                  
                    "images.avatar": posting_json_metadata.profile?.profile_image,
                    "images.cover": posting_json_metadata.profile?.cover_image,
                    "topics": posting_json_metadata.profile?.topcs || [],
                    needs_update: true
                  }
                }, {
                  upsert: true,
                  retryWrites: true
                })
                continue;
              }
              await hiveProfiles.findOneAndUpdate({
                _id: `hive/${profileData.account}`
              }, {
                $set: {
                  username: profileData.account,
                  TYPE: "HIVE",
                  displayName: posting_json_metadata.profile?.name,
                  about: posting_json_metadata.profile?.about,
                  location: posting_json_metadata.profile?.location,
                  website: posting_json_metadata.profile?.website,
                  "extra.pinned_post": posting_json_metadata.profile?.pinned,
                  "images.avatar": posting_json_metadata.profile?.profile_image,
                  "images.cover": posting_json_metadata.profile?.cover_image,
                  "did": posting_json_metadata.did,
                }
              }, {
                upsert: true,
                retryWrites: true
              })
            }
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
              let allowed_by_type = ALLOWED_APPS.includes(typye.type);
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
                continue;
              }
    
              const alreadyExisting = await posts.findOne({
                parent_author,
                parent_permlink,
                author,
                permlink,
              })
              if (alreadyExisting) {
                //Ensure state can ONLY go foward
                if (alreadyExisting.state_control.block_height < block_height) {
                  //TODO: more safety on updating already existing records. Cleanse fields
                  const patch = op[1].body
                  var dmp = new DiffMatchPatch();
    
                  let body;
                  try {
                    body = dmp.patch_apply(dmp.patch_fromText(patch), alreadyExisting.body)[0]
                  } catch {
                    body = patch
                  }
  
                  let newStatus = "published"
                  if(Array.isArray(json_metadata.flags)) {
                    if(json_metadata.flags.includes('deleted')) {
                      newStatus = 'deleted'
                    }
                  }
                  
                  if(Array.isArray(json_metadata.tags)) {
                    if(json_metadata.tags.includes('deleted')) {
                      newStatus = 'deleted'
                    }
                  }
                  
                  postsBulkWrite.find({
                    _id: alreadyExisting._id
                  }).updateOne({
                    $set: {
                      ...op[1],
                      status: newStatus,
                      body,
                      json_metadata,
                      "state_control.block_height": block_height,
                      tags,
                      updated_at: new Date(block.timestamp),
                      TYPE: 'HIVE',
                      metadata_status: 'unprocessed'
                    },
                  })
                  // await posts.findOneAndUpdate({
                  //   _id: alreadyExisting._id
                  // }, {
                  // })
                }
              } else {
                //If post does not exist
                try {
                  //TODO: more safety on updating already existing records. Cleanse fields


                  const secondOperation = tx.operations[1];

                  let beneficiaries = null
                  if(secondOperation) {
                    if(secondOperation[0] === "comment_options") {
                      // console.log(secondOperation[1])
                      const extensions = secondOperation[1].extensions

                      const maybeBene = extensions[0]
                      if(maybeBene) {
                        const [op, payload] = maybeBene
                        if(op === 'comment_payout_beneficiaries') {
                          beneficiaries = payload.beneficiaries
                        }
                      }
                    }
                  }

                  const calculatedMetadata = {} as any
                  const flags = []

                  const thirdOperation = tx.operations[2];

                  if(thirdOperation) {
                    //Should be custom json. Double check though.
                    //This should work for 98% of videos. However, a growing number of 3rd party and mobile app uploads won't have this.
                    if(thirdOperation[0] === "custom_json") {
                      if(thirdOperation[1].id === "3speak-publish" && thirdOperation[1].required_posting_auths.includes('threespeak')) {
                        obj_set(calculatedMetadata, 'app_metadata.spkvideo.authority_signed', true)
                      }
                    }
                  }

                  const {ipfs_links, source_map} = pulloutIpfsLinks(json_metadata)
                  if(json_metadata.app?.startsWith('3speak/')) {
                    const alreadyExisting = await posts.findOne({
                      author,
                      "video.first_upload": true
                    })
                    if(!alreadyExisting) {
                      obj_set(calculatedMetadata, 'app_metadata.spkvideo.first_upload', true)
                    }
                    
                    let storage_type = "legacy"

                    if(source_map.find(e => {
                      return e.type === "thumbnail"
                    })) {
                      storage_type = "thumbnail_ipfs"
                    }
                    
                    if(source_map.find(e => {
                      return e.type === "video"
                    })) {
                      storage_type = "ipfs"
                    }
                    obj_set(calculatedMetadata, "app_metadata.spkvideo.storage_type", storage_type)
                  }

                  obj_set(calculatedMetadata, "app_metadata.types", Object.keys(calculatedMetadata.app_metadata))
                  obj_set(calculatedMetadata, "app_metadata.app", json_metadata.app.split('/')[0])
                  
                  if(op[1].parent_author !== "") {
                    flags.push('comment')
                  }

                  postsBulkWrite.insert({
                    ...op[1],
                    ...calculatedMetadata,
                    status: 'published',
                    json_metadata,
                    state_control: {
                      block_height: block_height,
                    },
                    origin_control: {
                      allowed_by_parent,
                      allowed_by_type
                    },
                    tags,
                    created_at: new Date(block.timestamp),
                    updated_at: new Date(block.timestamp),
                    TYPE: 'HIVE',
                    metadata_status: 'unprocessed',
                    beneficiaries,
                    ipfs_links,
                    __v: '0.1',
                    __t: "post_hive",
                    flags
                  })
                  // await posts.insertOne({
                  //   ...op[1],
                  //   json_metadata,
                  //   state_control: {
                  //     block_height: block_height,
                  //   },
                  //   origin_control: {
                  //     allowed_by_parent,
                  //     allowed_by_type
                  //   },
                  //   tags,
                  //   created_at: new Date(block.timestamp),
                  //   updated_at: new Date(block.timestamp),
                  //   TYPE: 'HIVE',
                  //   metadata_status: 'unprocessed'
                  // })
                } catch (ex) {
                  console.log(ex)
                }
              }
            }

          } catch (ex) {
            console.log(ex)
          }

        }
      }))
      busy = false;
      blockMS = Date.now() - lastStart;
      blockMSTotal = blockMS + blockMSTotal;
      blockMSCount = blockMSCount + 1;
      
      try {
        if (postsBulkWrite.batches.length > 0) {
          // console.log(postsBulkWrite.batches[0].operations, postsBulkWrite.batches.length)
          await postsBulkWrite.execute()
        }
      } catch (ex) {
        console.log(ex)
      }
      
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
