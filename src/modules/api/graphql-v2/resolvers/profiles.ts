import { mongoOffchan } from "../../../../services/db";
import { CERAMIC_HOST } from "../../../../utils";
import { indexerContainer } from "../../index";
// import { StreamID } from '@ceramicnetwork/streamid'


export class HiveProfile {
    rawBlob: any;
    constructor(rawBlob) {
        this.rawBlob = rawBlob;
    }

    get location() {
        return this.rawBlob.location || null
    }

    get name() {
        return this.rawBlob.displayName || null
    }

    get username() {
        return this.rawBlob.username
    }
    
    get about() {
        return this.rawBlob.about || null
    }

    get website() {
        return this.rawBlob.website || null
    }

    get json_metadata() {
        return this.rawBlob.json_metadata || null
    }
    
    get posting_json_metadata() {
        return this.rawBlob.posting_json_metadata || null
    }

    get images() {
      return {
        avatar: this.rawBlob.images.avatar,
        cover: this.rawBlob.images.cover
      }
    }

    //Basic identification

    get id() {
        return this.rawBlob['_id']
    }

    get did() {
        return this.rawBlob.did;
    }
    
    //Data typing
    get __typename() {
        return "HiveProfile"
    }
    
    
    get src() {
        return this.rawBlob.TYPE
    }
        

    

    static async run(args) {

        const account = await indexerContainer.self.profileDb.findOne({
          username: args.username
        })
        // const accounts = await HiveClient.database.getAccounts([
        //     args.username
        // ])
        // const account = accounts[0]
        // try {
        //     account.json_metadata = JSON.parse(account.json_metadata)
        // } catch (ex) {
        //     //console.log(ex)
        // }
        // try {

        //     ;(account as any).posting_json_metadata = JSON.parse((account as any).posting_json_metadata)
        // } catch (ex) {
        //     //console.log((account as any).posting_json_metadata )
        //     //console.log(ex)
        //     //Parse json_metadata as valid for now
        //     try {
        //         ;(account as any).posting_json_metadata = JSON.parse((account as any).json_metadata)
        //     } catch {
        //     }
        // }

        

        if(!account) {
            return null;
        }

        return new HiveProfile(account);
    }
}

export class CeramicProfile {
    rawblob: any;
    did: string

    constructor(rawblob, did) {
        this.rawblob = rawblob;
        this.did = did;
    }

    get id() {
        return this.did
    }

    get name() {
        return this.rawblob.name
    }

    get location() {
        return this.rawblob.location
    }

    get about() {
        return this.rawblob.description
    }

    get website() {
        return this.rawblob.url
    }

    get images() {
        return {
            avatar: this.rawblob.image?.original?.src,
            background: this.rawblob.background?.original?.src
        }
    }

    get src() {
        return "CERAMIC"
    }

    get __typename() {
        return "CeramicProfile"
    }

    static async run(args) {
        const DIDDataStore = (await import('@glazed/did-datastore')).DIDDataStore
        const DataModel = (await import('@glazed/datamodel')).DataModel
        // const Core = (await import('@self.id/core')).Core
        // const TileLoader = (await import('@glazed/tile-loader')).TileLoader
        // const StreamID = (await import("@ceramicnetwork/streamid")).StreamID

        const aliases = {
            definitions: {
                profile: 'kjzl6cwe1jw145cjbeko9kil8g9bxszjhyde21ob8epxuxkaon1izyqsu8wgcic',
              },
              schemas: {
                Profile:
                  'ceramic://k3y52l7qbv1frxt706gqfzmq6cbqdkptzk8uudaryhlkf6ly9vx21hqu4r6k1jqio',
              },
              tiles: {},
          }
          
        const model = new DataModel({ ceramic: indexerContainer.self.ceramic, aliases })
        const dataStore = new DIDDataStore({ ceramic: indexerContainer.self.ceramic, model })

        const profile = await dataStore.get('profile', args.id)

        return new CeramicProfile(profile, args.id)
    }
}