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

    updated_at: Date
    created_at: Date
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