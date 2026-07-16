const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { loadAppConfig } = require('./config/env');

module.exports = (_env, argv = {}) => {
  const appConfig = loadAppConfig({ envName: argv.mode });
  const isEnvProduction = argv.mode === 'production';
  
  const transpileDependencies = [
    '@remix-run',
    '@reduxjs',
    '@radix-ui',
    'vaul',
    'immer',
    'react-redux',
    'react-router',
    'react-router-dom',
    'redux',
    'redux-thunk',
    'reselect',
    'tailwind-merge',
    'use-sync-external-store'
  ].map((name) => path.resolve(__dirname, 'node_modules', name));
  const shouldSkipBabel = (modulePath) => (
    modulePath.includes('node_modules')
    && !transpileDependencies.some((dependencyPath) => modulePath.startsWith(dependencyPath))
  );

  return {
    target: ['web', 'es5'],
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isEnvProduction ? '[name].[contenthash].js' : '[name].bundle.js',
      chunkFilename: isEnvProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
      clean: true,
      publicPath: '/',
      environment: {
        arrowFunction: false,
        const: false,
        destructuring: false,
        dynamicImport: false,
        forOf: false,
        module: false,
        optionalChaining: false,
        templateLiteral: false
      }
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@utils': path.resolve(__dirname, 'src/utils')
      }
    },
    module: {
      rules: [
        {
          test: /.(mjs|js|jsx)$/,
          exclude: shouldSkipBabel,
          use: {
            loader: 'babel-loader'
          }
        },
        {
          test: /.css$/,
          use: [
            isEnvProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader'
          ]
        },
        {
          test: /.(svg|png|jpe?g|gif)$/i,
          type: 'asset/resource'
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.APP_API_BASE_URL': JSON.stringify(appConfig.apiBaseUrl),
        'process.env.APP_TITLE': JSON.stringify(appConfig.title),
        'process.env.APP_SHORT_TITLE': JSON.stringify(appConfig.shortTitle)
      }),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        favicon: './public/favicon.svg',
        title: `${appConfig.title} - 管理端`
      }),
      isEnvProduction && new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
        chunkFilename: '[id].[contenthash].css'
      })
    ].filter(Boolean),
    optimization: {
      minimize: isEnvProduction,
      minimizer: [
        '...',
        new CssMinimizerPlugin()
      ],
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: Infinity,
        minSize: 0,
        cacheGroups: {
          reactVendor: {
            test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
            name: 'react-vendor',
            chunks: 'all',
            priority: 40
          },
          reduxVendor: {
            test: /[\\/]node_modules[\\/](@reduxjs|react-redux|redux|redux-thunk|reselect)[\\/]/,
            name: 'redux-vendor',
            chunks: 'all',
            priority: 30
          },
          lucideVendor: {
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            name: 'lucide-vendor',
            chunks: 'all',
            priority: 25
          },
          uiVendor: {
            test: /[\\/]node_modules[\\/](@radix-ui|vaul|class-variance-authority|tailwind-merge|tailwindcss-animate)[\\/]/,
            name: 'ui-vendor',
            chunks: 'all',
            priority: 20
          },
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true
          }
        }
      }
    },
    devServer: {
      port: appConfig.port,
      historyApiFallback: true,
      hot: true,
      open: false
    }
  };
};
