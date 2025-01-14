module.exports = {
  name: 'resource-plugin',
  config: {},
  hooks: {
    packageAfterCopy: async (config, buildPath, electronVersion, platform, arch) => {
      const fs = require('fs-extra');
      const path = require('path');
      
      // Copy vector_store to resources
      const srcPath = path.resolve(__dirname, 'vector_store');
      const destPath = path.join(buildPath, 'vector_store');
      
      await fs.copy(srcPath, destPath);
      console.log('Copied vector_store to:', destPath);
    }
  }
};
