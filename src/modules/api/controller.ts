import { Body, Controller, Post } from '@nestjs/common'
import { NULL_DID } from '../../utils'
import { indexerContainer } from '.'


@Controller(`/api/v1`)
export class GatewayApiController {
  @Post('create_stream_id')
  async createStreamId(@Body() body) {
    console.log(body)
    const post = await indexerContainer.self.posts.findOne({
      author: body.author,
      permlink: body.permlink,
    })
    if (!post) {
      return {
        stream_id: null,
      }
    }
    if (post.offchain_id) {
      return {
        stream_id: post.offchain_id,
      }
    } else {
      const out = await indexerContainer.self.streamBridge.createStreamId({
        author: body.author,
        permlink: body.permlink,
      })
      await indexerContainer.self.posts.findOneAndUpdate(post, {
        $set: {
          offchain_id: out.stream_id,
        },
      })
      return {
        stream_id: out.stream_id,
        trx_id: out.trx_id,
      }
    }
  }
}
