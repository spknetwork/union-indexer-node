export interface PostStruct {
    //Headers
    parent_author: string
    parent_permlink: string

    author: string
    permlink: string

    status: "published" | string
    
    //Content
    title: string
    body: string
    tags: Array<string>
    
    updated_at: Date
    created_at: Date

    //Internal calculation

    metadata_status: "processed" | "unprocessed"
    need_stat_update: boolean
    
    //Stats calculated from on chain data
    stats?: {
        num_comments?: number
        num_votes?: number
        total_hive_reward?: number
    }

    //Ensuring we always write forward into the future. Conflict prevention
    state_control: {
        block_height?: number
        version_id?: string
    }

    //We can track where this piece of content came from and why. Is it a comment? Or something that is typed?
    origin_control: {
        allowed_by_parent?: boolean
        allowed_by_type?: boolean
        allowed_by_community?: boolean //Not used yet
    }
    
    //Original json_metadata
    json_metadata: {
        image: string[]
        tags: string[]
        app: string
        [x: string]: any //Everything else
    }

    app_metadata: {
        "spkvideo"?: {
            authority_signed?: boolean //Signed by the @threespeak account and thus uploaded through our account.
            storage_type?: "legacy" | "thumbnail_ipfs" | "ipfs"
            first_upload?: boolean
            [x: string]: any 
        }
        [x: string]: any
    }
    
    ipfs_links: Array<{
        cid: string
    }>

    beneficiaries: Array<{
        account: string
        weight: number // 10_000 place
    }>

    
    //Extra
    __v: '0.1'
    __t: 'post_hive' | 'post_ceramic'
    flags: string[] // "comment"
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



interface DesktopVideo {

    title: string
    description: string
    tags: string[]

    sourceMap: Array<{type: string, url: string, format: string}>
    filesize: number
    created: string
    video: {
        duration: number
        info: {
            author: string
            permlink: string
        }
    }
    app: string
    type: string
}

interface ThreespeakVideo {
    app: string
    type: string
    image: string[]
    video: {
        info: {
            platform: '3speak'
            title: string
            author: string
            permlink: string
            duration: number
            filesize: number
            file: string
            lang: string
            firstUpload: boolean
            ipfs: string | null
            ipfsThumbnail: string | null
        }
        content: {
            description: string
            tags: string[]
        }
    }
}