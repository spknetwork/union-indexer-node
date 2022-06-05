import Twitter from 'twitter-text'

export function extractBase(body) {
    const tags = Twitter.extractHashtags(body);
    const urls = Twitter.extractUrls(body);
    return {
        tags,
        urls
    }
}