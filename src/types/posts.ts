export interface PostHive {
    parent_author: string
    parent_permlink: string
    parent_blockchain: string

    author: string
    permlink: string
    blockchain: string; //Source of the content. Can be Hive or Ceramic (or other arbitrary source)
    title: string
    body: string

    date: Date
    
    json_metadata: {
        image: string[]
        tags: string[]
        app: string
    }
}

export interface PostSpk {
    parent_author: string
    parent_permlink: string
    parent_blockchain:string

    author: string
    permlink: string
    blockchain: string; //Source of the content. Can be Hive or Ceramic (or other arbitrary source)
    title: string
    body: string

    //If applicable
    chain_metadata?: {
        head_trx: string
    }
}

export interface VideoSpk extends PostSpk {

}