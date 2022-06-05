import { mongo } from '../services/db'
import { HiveClient, sleep } from '../utils'
import Axios from 'axios'

/**
 * Pulls offchain data into indexer
 * Note: this is very inefficient and early version
 */

const API_URL = 'https://us-01.infra.3speak.tv/v1/graphql'

const QUERY = `

query Query {
    publicFeed {
        stream_id
        version_id
        parent_id
        creator_id
        title
        body
        category
        lang
        type
        app
        json_metadata
        app_metadata
        debug_metadata
        community_ref
        created_at
        updated_at
        state_control {
            height
        }
    }
}

`

void (async () => {
  const db = mongo.db('spk-union-indexer')
  const hiveStreamState = db.collection('hive_stream_state')
  const posts = db.collection('posts')
  const stats = db.collection('stats')
  const notifications = db.collection('notifications')
  await mongo.connect()

  await posts.deleteMany({
      "TYPE": "CERAMIC"
  })
  try {
      const {data} = await Axios.post(API_URL, {
        query: QUERY,
      })
      for(let object of data.data.publicFeed) {
        console.log(object)
        const alreadyExisting = await posts.findOne({
            stream_id: object.stream_id
        })
        if(!alreadyExisting) {
            await posts.insertOne({
                parent_id: object.parent_id,
                stream_id: object.stream_id,
                author: object.creator_id,
                title: object.title || "",
                body: object.body || "",
                json_metadata: object.json_metadata || {},
                state_control: {
                    version_id: object.version_id,
                    height: object.state_control.height
                },
                origin_control: {
                    allowed_by_type: true,
                    allowed_by_parent: false
                },
                created_at: new Date(object.created_at),
                updated_at: new Date(object.updated_at),
                TYPE: "CERAMIC"
            })
        } else {
            //TODO handle updating
        }
      }
      
  } catch (ex) {
    console.log(JSON.stringify(ex.response.data))
  }
})()
