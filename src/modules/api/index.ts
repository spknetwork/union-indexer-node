import { Injectable, Module, NestMiddleware } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { buildSchema, GraphQLScalarType } from 'graphql'
import { createSchema, createYoga } from 'graphql-yoga'
import { JSONResolver} from "graphql-scalars"
import { CoreService } from '../../services'
import { GatewayApiController } from './controller'
import { Schema as SchemaV2 } from './graphql-v2/schema'
import { Resolvers as ResolversV2 } from './graphql-v2/resolvers/index'

export const ipfsContainer: {  } = {} as any
export const indexerContainer: { self: CoreService  } = {} as any


export const schemaV2 = createSchema({
  typeDefs: /* GraphQL */ SchemaV2,
  resolvers: {
    Query: ResolversV2,
    // JSON: JSONResolver
  },
  resolverValidationOptions: {
    requireResolversForAllFields: 'ignore'
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

    
 
    

    const yogaV2 = createYoga({
      schema: schemaV2,
      graphqlEndpoint: `/api/v2/graphql`,
      graphiql: {
        //NOTE: weird string is for formatting on UI to look OK
        defaultQuery: /* GraphQL */ "" +
          "query MyQuery {\n" +
          " latestFeed(limit: 10) {\n" +
          "   items {\n" +
          "      ... on HivePost {\n" +
          "        parent_permlink\n" +
          "        parent_author\n" +
          "        title\n" +
          "        body\n" +
          "      }\n" +
          "    }\n"+
          "  }\n" +
          "}\n"
      },
    })
 
    app.use('/api/v2/graphql', yogaV2)
    // Pass it into a server to hook into request handlers.

    app.enableShutdownHooks()

    await app.listen(this.listenPort)
  }
}
