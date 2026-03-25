module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['react-native-worklets-core/plugin'],
    '@babel/plugin-proposal-export-namespace-from',
    'react-native-worklets/plugin',
  ],
};
