import { indexerContainer } from "../../index";
import { HivePost } from "./posts";

export function TransformArgToMongodb(
    args: any
  ) {
    if (!args) {
      return {};
    }
  let queryParams: Record<string, any> = {}
  for (let keyRaw in args) {
      const key = keyRaw as keyof typeof args;
      if ((key === '_in' || key === '_nin') && !args[key]?.length) {
        continue;
      }
      queryParams[key.replace('_', '$')] = args[key];
    }
    return queryParams;
  }

function TransformNestedQuery(query: any, root_key: string): any {
  if (!query) {
    return {}
  }
  let out: Record<string, any> = {}
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith('_')) {
      out[`${root_key}.${key}`] = TransformArgToMongodb(value)
    } else {
      if (out[root_key]) {
        out[root_key][key.replace('_', '$')] = value
      } else {
        out[root_key] = { [key.replace('_', '$')]: value }
      }
    }
  }
  return out
}

  
export const Resolvers = {
    socialFeed: async (_, args) => {
        let query = {} as any
        
        if(args.spkvideo?.firstUpload) {
            query['app_metadata.spkvideo.first_upload'] = true
        }

        if(args.spkvideo?.only) {
            query['app_metadata.types'] = "spkvideo"
        }

        if(args.feedOptions?.includeComments) {
            query['flags'] = {
                $in: ['comment']
            }
        } else {
            query['flags'] = {
                $nin: ['comment']
            }
        }

        if(args.feedOptions?.byTag) {
            query['tags'] = TransformArgToMongodb(args.feedOptions.byTag)
        }

        if(args.feedOptions?.byCreator) {
            query['author'] = TransformArgToMongodb(args.feedOptions.byCreator)
        }
        
        if(args.feedOptions?.byCommunity) {
            query['parent_permlink'] = TransformArgToMongodb(args.feedOptions.byCommunity)
        }

        if(args.feedOptions?.byApp) {
            query['app_metadata.app'] = TransformArgToMongodb(args.feedOptions.byApp)
        }

        if(args.feedOptions?.byType) {
            query['app_metadata.types'] = TransformArgToMongodb(args.feedOptions.byType)
        }

        // console.log(, args)
        const outPut = await indexerContainer.self.posts.find({
            ...query,
            TYPE: {$ne: "CERAMIC"}
        }, {
            limit: args.pagination?.limit || 100,
            sort: {
                created_at: -1
            }
        }).toArray()
        console.log(outPut)
        return {
            items: outPut.map(e => {
                e["__typename"] = "HivePost"
                return new HivePost(e);
            })
        }
    }
}