const {
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
  NODE_ENV = 'development'
} = process.env;

if (!process.env.NODE_ENV) {
  throw new Error('The env variables are not set up correctly (probably missing) '
    + 'for sequelize migrations');
}

module.exports = {
  [NODE_ENV]: {
    username: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DB,
    host: POSTGRES_HOST,
    port: POSTGRES_PORT,
    dialect: 'postgres'
  }
};