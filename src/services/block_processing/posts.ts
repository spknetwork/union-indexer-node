export function detectPostType(post) {
    let type;
    if(typeof post.json_metadata === "string") {
        type = "unknown"
    }
    console.log(post.json_metadata.app)
    if(typeof post.json_metadata.app === "string") {
        const [app, version] = post.json_metadata.app.split('/')
        if(app === "3speak") {
            type = "3speak"
            console.log(`Found! ${post.json_metadata.app}`)
        }
    }
    if(!type) {
        type = "unknown"
    }
    return {
        type
    }
}

export function normalizePost(post) {
    
}