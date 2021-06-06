module.exports = {
  apps: [
    {
      script: 'app.js',
      watch: true,
      interpreter: './node_modules/.bin/babel-node',
      env: {
        NODE_ENV: 'development',
        watch: false,
      },
      env_dev: {
        name: 'thisdev',
        NODE_ENV: 'production',
        watch: true,
        DB_NAME: 'testdatabase',
        DB_HOST: 'localhost',
        DB_PORT: '3306',
        DB_USER: 'root',
        DB_PASS: 'ghd123',
        DB_DIALECT: 'mysql',
      },
      env_production: {
        NODE_ENV: 'production',
        watch: false,
      },
    },
  ],

  deploy: {
    production: {
      user: 'SSH_USERNAME',
      host: 'SSH_HOSTMACHINE',
      ref: 'origin/master',
      repo: 'GIT_REPOSITORY',
      path: 'DESTINATION_PATH',
      'pre-deploy-local': '',
      'post-deploy':
        'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
};
