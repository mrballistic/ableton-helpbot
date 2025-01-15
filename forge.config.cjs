'use strict';

const path = require('path');
require('./forge.env.cjs');

const projectDir = __dirname;

module.exports = {
  packagerConfig: {
    name: 'Ableton AI Chatbot',
    executableName: 'Ableton AI Chatbot',
    icon: path.join(projectDir, 'build', 'logo.icns'),
    appBundleId: 'com.mrballistic.ableton.rag',
    osxSign: {
      identity: 'Developer ID Application: Todd Greco (89YJQ4UB7V)',
      hardenedRuntime: true,
      entitlements: path.join(projectDir, 'build', 'entitlements.mac.plist'),
      'entitlements-inherit': path.join(projectDir, 'build', 'entitlements.mac.plist'),
      signatureFlags: ['runtime']
    },
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    },
    files: [
      "**/*",
      "!node_modules/**/*",
      "node_modules/@langchain/**/*",
      "node_modules/langchain/**/*",
      "node_modules/hnswlib-node/**/*",
      "node_modules/hnswlib-node/build/Release/addon.node",
      "vector_store/**/*"
    ],
    extraResource: ['vector_store'],
    asar: {
      unpack: "node_modules/hnswlib-node/build/Release/addon.node"
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        name: 'Ableton AI Chatbot',
        icon: path.join(projectDir, 'build', 'logo.icns'),
        overwrite: true,
        identity: 'Developer ID Application: Todd Greco (89YJQ4UB7V)'
      }
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
    }
  ]
};
