export interface DelegatedAuthority {
    type: "posting" | "active"; //Posting will almost always be used
    from: string
    to: string
    date: Date
    trx_id: string
    block_height: number
}

interface SpkFollow {
    id: 'spk.follow' | 'spk.unfollow'
    json: {
        did: string
    }
}