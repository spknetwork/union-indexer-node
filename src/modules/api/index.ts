import { Injectable, Module, NestMiddleware } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { buildSchema, GraphQLScalarType } from 'graphql'
import { createSchema, createYoga } from 'graphql-yoga'
import { JSONResolver} from "graphql-scalars"
import { CoreService } from '../../services'
import { GatewayApiController } from './controller'
import { Resolvers } from './graphql/resolvers'
import { Schema } from './graphql/schema'

export const ipfsContainer: {  } = {} as any
export const indexerContainer: { self: CoreService  } = {} as any

export const schema = createSchema({
  typeDefs: /* GraphQL */ Schema,
  resolvers: {
    Query: Resolvers,
    // JSON: JSONResolver
  },
  resolverValidationOptions: {
    requireResolversForAllFields: 'warn',
  }
})

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

    const yoga = createYoga({
      schema,
      graphqlEndpoint: `/api/v1/graphql`,
      graphiql: {
        defaultQuery: /* GraphQL */ `
          query {
            hello
          }
        `,
      },
    })
 
    app.use('/api/v2/graphql', yoga)
    // Pass it into a server to hook into request handlers.

    app.enableShutdownHooks()

    await app.listen(this.listenPort)
  }
}
