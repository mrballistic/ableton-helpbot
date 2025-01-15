const path = require('path');
require('./forge.env.js');

module.exports = {
  packagerConfig: {
    name: 'Ableton AI Chatbot',
    executableName: 'Ableton AI Chatbot',
    icon: path.join(__dirname, 'build', 'logo.icns'),
    appBundleId: 'com.mrballistic.ableton.rag',
    osxSign: {
      identity: '89YJQ4UB7V',
      'hardened-runtime': true,
      entitlements: 'build/entitlements.mac.sandbox.plist',
      'entitlements-inherit': 'build/entitlements.mac.sandbox.plist',
      'signature-flags': 'library'
    },
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    },
    extraResource: [
      'vector_store'
    ],
    files: [
      "**/*",
      "node_modules/**/*",
      "vector_store/**/*"
    ],
    asar: true,
    prune: false
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'Ableton AI Chatbot',
        icon: path.join(__dirname, 'build', 'logo.icns'),
        overwrite: true,
        identity: '89YJQ4UB7V'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'electron/main.cjs',
            config: 'vite.main.config.js'
          },
          {
            entry: 'electron/preload.cjs',
            config: 'vite.preload.config.js'
          }
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.js'
          }
        ]
      }
    },
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ]
};
