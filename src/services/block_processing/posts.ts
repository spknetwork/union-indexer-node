export function detectPostType(post) {
    let type;
    if(typeof post.json_metadata === "string") {
        type = "unknown"
    }
    if(typeof post.json_metadata.app === "string") {
        const [app, version] = post.json_metadata.app.split('/')
        if(app === "3speak") {
            type = "3speak"
        }
        if(app === "dBuzz") {
            type = "dbuzz"
        }
        if(app === "steemit") {
            type = "steemit"
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

export const ALLOWED_APPS = ['3speak', 'dbuzz']