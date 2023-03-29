//@ts-ignore
import { CeramicClient } from '@ceramicnetwork/http-client'
import { PrivateKey } from '@hiveio/dhive'
import { HiveClient, NULL_DID } from '../utils'
import { CoreService } from './index'

export async function createPostStreamID(post, ceramic: CeramicClient) {
  const { TileDocument } = await import('@ceramicnetwork/stream-tile')

  const header = {
    types: 'external_ref/social_post',
    post_type: 'hive',
    author: post.author,
    permlink: post.permlink,
    deterministic: true,
    controllers: [NULL_DID],
  }
  const result = { header }

  const tileDoc = await ceramic.createStreamFromGenesis(TileDocument.STREAM_TYPE_ID, result)

  return tileDoc.id.toString()
}

/**
 * Tells other indexers that a stream_id has been created for a post
 * This is solely meant for preventing unneeded spam on the Ceramic network and decrease the amount of ops a node must under take.
 */
export class StreamBridge {
  self: CoreService
  constructor(self: CoreService) {
    this.self = self
  }

  async createStreamId(args: any) {
    //createStrea
    let stream_id = await createPostStreamID(args, this.self.ceramic)

    const out = await HiveClient.broadcast.json(
      {
        required_auths: [],
        required_posting_auths: [process.env.BRIDGE_USERNAME],
        id: 'spk.bridge_id',
        json: JSON.stringify({
          platform: 'HIVE',
          author: args.author,
          permlink: args.permlink,
          stream_id,
        }),
      },
      PrivateKey.fromString(process.env.BRIDGE_POSTING_KEY),
    )

    return {
      stream_id,
      trx_id: out.id
    };
  }
}
