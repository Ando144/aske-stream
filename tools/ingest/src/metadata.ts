// The YouTube metadata helpers now live in @aske/shared so the apps use the same rules.
export {
  cleanArtist,
  cleanTitle,
  isYoutubeUrl,
  metadataFromYoutube,
  youtubePlaylistId,
  youtubeVideoId,
  type CleanMetadata,
  type YtInfo,
} from '@aske/shared/youtube';
