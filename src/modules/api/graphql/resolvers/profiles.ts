import { indexerContainer } from "../../index";

export class CeramicProfile {
    rawBlob: any;

    static async run() {

    }
}

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

        console.log('account data', account)

        if(!account) {
            return null;
        }

        return new HiveProfile(account);
    }
}