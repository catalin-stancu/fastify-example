export default {
  shortName: 'dam',
  appCode: '003',
  ignoreFilesOrFolders: 'common',
  locales: {
    dirName: './locales',
    defaultLocale: 'ro',
    enabledLanguages: ['ro', 'en']
  },
  jobQueue: {
    name: 'resizeQueue'
  },
  fileRules: {
    naming: {
      match: / /ig,
      replaceWith: '-'
    },
    maxFileBytes: 5 * (2 ** 20), // 5MB
    maxFiles: 20,
    mimeTypes: [
      'video/mp4',
      'audio/mp3',
      'audio/mpeg',
      'image/jpeg',
      'image/png',
      'application/zip',
      'application/x-zip-compressed',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.presentation'
    ],
    supportedImageTypes: ['jpeg', 'png'],
    preview: {
      width: 100,
      height: 80
    }
  }
};