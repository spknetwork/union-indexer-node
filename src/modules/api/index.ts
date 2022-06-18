import { Injectable, Module, NestMiddleware } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { graphqlHTTP } from 'express-graphql' // ES6
import { buildSchema } from 'graphql'
import { CoreService } from '../../services'
import { GatewayApiController } from './controller'
import { Resolvers } from './graphql/resolvers'
import { Schema } from './graphql/schema'

export const ipfsContainer: {  } = {} as any
export const indexerContainer: { self: CoreService  } = {} as any


@Module({
  imports: [],
  controllers: [GatewayApiController],
  providers: [],
})
class ControllerModule {}

/**
 * see api requirements here https://github.com/3speaknetwork/research/discussions/3
 */
export class IndexerApiModule {
  constructor(
    private readonly selfInput:  CoreService,
    private readonly listenPort: number,
  ) {
    indexerContainer.self = selfInput;
  }

  public async listen() {
    const app = await NestFactory.create(ControllerModule, {
      cors: true,
    })
    app.use(
      '/api/v1/graphql',
      graphqlHTTP({
        schema: buildSchema(Schema),
        graphiql: true,
        rootValue: Resolvers,
      }),
    )

    app.enableShutdownHooks()

    await app.listen(this.listenPort)
  }
}
