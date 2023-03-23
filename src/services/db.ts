import { MongoClient } from 'mongodb'
import 'dotenv/config'
import mongoose, { Schema } from 'mongoose'

const OFFCHAIN_INDEXER_MONGODB = process.env.OFFCHAIN_MONGO_HOST || '127.0.0.1:27017'

export const mongoOffchan = new MongoClient(`mongodb://${OFFCHAIN_INDEXER_MONGODB}`)

const MONGO_HOST = process.env.MONGO_HOST || '127.0.0.1:27017'

export const MONGODB_URL = `mongodb://${MONGO_HOST}`
export const mongo = new MongoClient(MONGODB_URL)

mongoose.connect(MONGODB_URL, {
  dbName: 'spk-union-indexer',
  autoIndex: true,
})

var PostSchema = new Schema()

PostSchema.index({
  id: 1,
})

PostSchema.index({
  author: 1,
  permlink: 1,
})

PostSchema.index({
  parent_permlink: 1,
})

PostSchema.index({
  'json_metadata.app': 1,
  created_at: -1,
})

PostSchema.index({
  'stats.num_comments': -1,
})

PostSchema.index({
  tags: 1,
})

PostSchema.index({
  permlink: 1,
})

PostSchema.index({
  body: 'text',
})

PostSchema.index(
  {
    'app_metadata.spkvideo.first_upload': -1,
    created_at: -1,
  },
  {
    partialFilterExpression: {
      'app_metadata.spkvideo.first_upload': {
        $exists: true,
      },
    },
  },
)

PostSchema.index(
  {
    'app_metadata.types': -1,
    created_at: -1,
  },
  {
    partialFilterExpression: {
      'app_metadata.spkvideo.types': {
        $exists: true,
      },
    },
  },
)

PostSchema.index(
  {
    'app_metadata.app': -1,
    created_at: -1,
  },
  {
    partialFilterExpression: {
      'app_metadata.app': {
        $exists: true,
      },
    },
  },
)

PostSchema.index(
  {
    'flags': -1,
  },
  {
    partialFilterExpression: {
      'flags': {
        $exists: true,
      },
    },
  },
)

PostSchema.index(
  {
    'need_stat_update': -1,
  },
  {
    partialFilterExpression: {
      'need_stat_update': {
        $exists: true,
      },
    },
  },
)

PostSchema.index(
  {
    'needs_stream_id': -1,
  },
  {
    partialFilterExpression: {
      'needs_stream_id': {
        $exists: true,
      },
    },
  },
)

const notifications = new Schema()

notifications.index({
  ref: 1,
  target: 1
})
//Unused

const follows = new Schema()

follows.index({
  following: -1,
  follower: -1
})


const delegatedAuthority = new Schema()

delegatedAuthority.index({
  from: 1
})

delegatedAuthority.index({
  from: -1
})

export const Models = {
  PostsModel: mongoose.model('posts', PostSchema),
  FollowsModel: mongoose.model('follows', follows),
  DelegatedAuthorityModel: mongoose.model('delegated-authority', delegatedAuthority),
}
