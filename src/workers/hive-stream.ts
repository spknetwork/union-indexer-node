import { CONFIG } from '../config'
import { ALLOWED_APPS, detectPostType } from '../services/block_processing/posts'
import { mongo } from '../services/db'
import { fastStream, HiveClient } from '../utils'
import DiffMatchPatch from '@2toad/diff-match-patch'
import Moment from 'moment'

void (async () => {
  const db = mongo.db('spk-union-indexer')
  const hiveStreamState = db.collection('hive_stream_state')
  const posts = db.collection('posts')
  const stats = db.collection('stats')
  const hiveProfiles = db.collection('profiles')
  const followsDb = db.collection('follows')
  const communityDb = db.collection('communities')
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

  try {
    for await (let data of str.stream) {
      const [block_height, block] = data as any
      //console.log(block_height)
      block_height_current = block_height

      last_time = new Date(block.timestamp);
      await Promise.all(block.transactions.map(async (tx: any) => {
        for (let op of tx.operations) {

          if(op[0] === "vote") {
            const vote_op = op[1]
            const post = await posts.findOne({
              author: vote_op.author,
              permlink: vote_op.permlink,
            })
            if(post) {
              await posts.findOneAndUpdate({
                _id: post._id
              }, {
                $set: {
                  need_stat_update: true
                }
              })
            }
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
                  upsert: true
                })
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
                    title: json.title,
                    description: json.about
                  }
                })
              }
            }
            if(id === "spk.follow") {
              //TODO: Implement spk following of offchain accounts
            }
            if(id === 'follow') {
              const json = JSON.parse(json_raw)
              if(json[0] === "follow") {
                const account = op[1].required_posting_auths[0]
                if(account !== json[1].follower) {
                  continue;
                }
                const followed = json[1].what.length >= 1
                if(followed) {
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
                    upsert: true
                  })
                } else {
                  await followsDb.findOneAndDelete({
                    _id: `hive-${json[1].follower}-${json[1].following}`
                  })
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
                  "topics": posting_json_metadata.profile?.topcs,
                }
              }, {
                upsert: true
              })
            }
            await hiveProfiles.findOneAndUpdate({
              _id: `hive-${profileData.account}`
            }, {
              $set: {
                username: profileData.account,
                TYPE: "HIVE",
                displayName: posting_json_metadata.profile?.name,
                description: posting_json_metadata.profile?.about,
                location: posting_json_metadata.profile?.location,
                website: posting_json_metadata.profile?.website,
                "extra.pinned_post": posting_json_metadata.profile?.pinned,
                "images.avatar": posting_json_metadata.profile?.profile_image,
                "images.cover": posting_json_metadata.profile?.cover_image,
                "did": posting_json_metadata.did,
              }
            }, {
              upsert: true
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
              return;
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
                await posts.findOneAndUpdate({
                  _id: alreadyExisting._id
                }, {
                  $set: {
                    ...op[1],
                    body,
                    json_metadata,
                    "state_control.block_height": block_height,
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
                //TODO: more safety on updating already existing records. Cleanse fields
                await posts.insertOne({
                  ...op[1],
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
                  metadata_status: 'unprocessed'
                })
              } catch (ex) {
                console.log(ex)
              }
            }
          }
        }
      }))
      await hiveStreamState.findOneAndUpdate(
        {
          id: 'block_height',
        },
        {
          $set: {
            block_height,
            last_time,
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
