// Jest Configuration for @OpsiMate/server
module.exports = {
  // Use ts-jest as the preset for TypeScript projects
  preset: 'ts-jest',
  
  // Use the Node.js test environment
  testEnvironment: 'node',
  
  // Define the root directory for relative paths
  rootDir: '.',

  // --- CRITICAL FIX: Overriding transformIgnorePatterns ---
  // By default, Jest ignores node_modules. We must explicitly tell it to transform 
  // the specific package that uses ES Module syntax (@kubernetes/client-node).
  transformIgnorePatterns: [
    // This regular expression tells Jest to ignore all node_modules directories
    // EXCEPT the one containing the @kubernetes/client-node package.
    "node_modules/(?!@kubernetes/client-node)/"
  ],

  // Ensure Babel is used for transformation on all relevant files (TS, JS, etc.)
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  
  // Configuration specific to ts-jest
  globals: {
    'ts-jest': {
      // Assuming you have configured a tsconfig for testing (e.g., to use 'CommonJS' modules)
      // If you don't have this file, you may need to copy your main tsconfig and rename it.
      tsconfig: 'tsconfig.jest.json', 
    },
  },
};
