import { MongoClient } from 'mongodb'
import 'dotenv/config'


const OFFCHAIN_INDEXER_MONGODB = process.env.OFFCHAIN_MONGO_HOST || '127.0.0.1:27017'

export const mongoOffchan = new MongoClient(`mongodb://${OFFCHAIN_INDEXER_MONGODB}`)

const MONGO_HOST = process.env.MONGO_HOST || '127.0.0.1:27017'

export const MONGODB_URL = `mongodb://${MONGO_HOST}`
export const mongo = new MongoClient(MONGODB_URL)