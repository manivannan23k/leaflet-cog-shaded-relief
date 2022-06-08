module.exports = {
    entry: './src/js/app.js',
    mode: 'development',
    output: {
      path: `${__dirname}/dist`,
      publicPath: `/dist/`,
      filename: 'bundle.js',
    },
    module: {
        rules: [
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
            ],
          },
          {
            test: /\.ttf$/,
            use: [
              'url-loader',
            ],
          },
        ],
      },
  };