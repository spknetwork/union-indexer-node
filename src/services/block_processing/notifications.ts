import { mongo } from '../db'
import twitter from 'twitter-text'
import { PostHive } from '../../types/posts'

const mentionRegex = /((?:^|[^a-zA-Z0-9_!#$%&*@＠]|(?:^|[^a-zA-Z0-9_+~.-])(?:rt|RT|rT|Rt):?))([@＠])([a-zA-Z0-9_:-]{1,80})(\/[a-zA-Z:][a-zA-Z0-9_:-]{0,24})?/g

export function createNotificationsFromPost(post: PostHive) {
  let possibleNames = []
  post.body.replace(
    mentionRegex,
    function (match, before, atSign, screenName, slashListname, offset, chunk) {
      var after = chunk.slice(offset + match.length)

      //if (!after.match(_endMentionMatch["default"])) {
      slashListname = slashListname || ''
      var startPosition = offset + before.length
      var endPosition = startPosition + screenName.length + slashListname.length + 1
      possibleNames.push({
        screenName: screenName,
        listSlug: slashListname,
        indices: [startPosition, endPosition],
      })
      //}
      return ''
    },
  )
  const mentions: string[] = possibleNames.map(e => e.screenName);

  let out = []
  for (let mention of mentions) {
    let type = mention.startsWith('did:') ? 'did' : 'hive'
    let target;
    if (type === 'hive') {
      target = mention.toLowerCase()
    } else {
      target = mention
    }
    out.push({
      target,
      type,
      mentioned_at: post.updated_at,
      ref: `hive/${post.author}/${post.permlink}`
    })
  }
  return out;
}