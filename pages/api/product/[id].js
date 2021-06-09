//const process = require('process');
const Knex = require('knex');

// Set up a variable to hold our connection pool. It would be safe to
// initialize this right away, but we defer its instantiation to ease
// testing different configurations.
let pool;

// [START cloud_sql_postgres_knex_create_tcp]
const createTcpPool = config => {
  // Extract host and port from socket address
  const dbSocketAddr = '';//process.env.DB_HOST.split(':'); // e.g. '127.0.0.1:5432'

  // Establish a connection to the database
  return Knex({
    client: 'pg',
    connection: {
      user: 'postgres',//process.env.DB_USER, // e.g. 'my-user'
      password: 'OadLD6lr5ikNyD3L', // e.g. 'my-user-password'
      database: 'postgres', // e.g. 'my-database'
      host: '34.89.193.69', // e.g. '127.0.0.1'
      port: '5432', // e.g. '5432'
    },
    // ... Specify additional properties here.
    ...config,
  });
};
// [END cloud_sql_postgres_knex_create_tcp]

// [START cloud_sql_postgres_knex_create_socket]
const createUnixSocketPool = config => {
  const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';

  // Establish a connection to the database
  return Knex({
    client: 'pg',
    connection: {
      user: 'postgres',//process.env.DB_USER, // e.g. 'my-user'
      password: 'OadLD6lr5ikNyD3L', // e.g. 'my-user-password'
      database: 'postgres', // e.g. 'my-database'
      host: '34.89.193.69', // e.g. '127.0.0.1'
      port: '5432', // e.g. '5432'
    },
    // ... Specify additional properties here.
    ...config,
  });
};
// [END cloud_sql_postgres_knex_create_socket]

// Initialize Knex, a Node.js SQL query builder library with built-in connection pooling.
const createPool = () => {
  // Configure which instance and what database user to connect with.
  // Remember - storing secrets in plaintext is potentially unsafe. Consider using
  // something like https://cloud.google.com/kms/ to help keep secrets secret.
  const config = { pool: {} };

  // [START cloud_sql_postgres_knex_limit]
  // 'max' limits the total number of concurrent connections this pool will keep. Ideal
  // values for this setting are highly variable on app design, infrastructure, and database.
  config.pool.max = 5;
  // 'min' is the minimum number of idle connections Knex maintains in the pool.
  // Additional connections will be established to meet this value unless the pool is full.
  config.pool.min = 5;
  // [END cloud_sql_postgres_knex_limit]

  // [START cloud_sql_postgres_knex_timeout]
  // 'acquireTimeoutMillis' is the number of milliseconds before a timeout occurs when acquiring a
  // connection from the pool. This is slightly different from connectionTimeout, because acquiring
  // a pool connection does not always involve making a new connection, and may include multiple retries.
  // when making a connection
  config.pool.acquireTimeoutMillis = 600000; // 60 seconds
  // 'createTimeoutMillis` is the maximum number of milliseconds to wait trying to establish an
  // initial connection before retrying.
  // After acquireTimeoutMillis has passed, a timeout exception will be thrown.
  config.createTimeoutMillis = 30000; // 30 seconds
  // 'idleTimeoutMillis' is the number of milliseconds a connection must sit idle in the pool
  // and not be checked out before it is automatically closed.
  config.idleTimeoutMillis = 600000; // 10 minutes
  // [END cloud_sql_postgres_knex_timeout]

  // [START cloud_sql_postgres_knex_backoff]
  // 'knex' uses a built-in retry strategy which does not implement backoff.
  // 'createRetryIntervalMillis' is how long to idle after failed connection creation before trying again
  config.createRetryIntervalMillis = 200; // 0.2 seconds
  // [END cloud_sql_postgres_knex_backoff]

  if (false) {
    return createTcpPool(config);
  } else {
    return createUnixSocketPool(config);
  }
};
const getStockById = async (pool, id) => {
  try {
    return await pool
      .select('entryid', 'product', 'description', 'stock')
      .from('stockentries').where('entryid', id);
  } catch (err) {
    throw Error(err);
  }
};


const updateStocks = async (pool, stock,id) => {
  delete stock.Apartment; 
  try {
    //return await pool('stocks').delete(stock);
    stock.entryid=id;
    return await pool('stockentries').update(stock).where('entryid', id);
  } catch (err) {
    throw Error(err);
  }
};

const removestock = async (pool, id) => {
  try {
    return await pool('stockentries').delete({key:'entryid'}).where('entryid',id);
  } catch (err) {
    throw Error(err);
  }
};


export default async function productHandler(req, res) {
  const {
    query: { id, name },
    method,
  } = req

  switch (method) {
    case 'GET':

      pool = pool || createPool();

      // Get data from your database
      try {
        const builds = await getStockById(pool, id);
        for (let index = 0; index < builds.length; index++) {
          builds[index].link = '/api/product/'+builds[index].entryid;
          
        }
        res
          .status(200)
          .send(builds)
          .end();
      } catch (err) {
        console.error(err);

        res
          .status(500)
          .send('Unable to load page; see logs for more details.')
          .end();
      }
      res.status(200).json({ id, name: `Product ${id}` })

      res.status(200).json(id)
      break
    case 'PUT':
      // Update or create data in your database
      //res.status(200).json({ id, name: name || `Product ${id}` })
      pool = pool || createPool();
      try {
       // res.setHeader('Access-Control-Allow-Origin', '*');
          await updateStocks(pool, req.body,id);
          res.status(203).send(req.body);
      } catch (err) {
          logger.error(`Error while attempting to submit vote:${err}`);
          //res.setHeader('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Origin', '*');
          res
          .status(500)
          .send('Unable to add stock see logs for more details.')
          .end();
          return;
      }

      break

      case 'DELETE':
        pool = pool || createPool();
       
        try{
          const builds = await removestock(pool,id);
          
                 res
               .status(204)
               .send(JSON.stringify(id))
               .end();
        }catch (err) {
             console.error(err);
             res
               .status(500)
               .send('Unable to delete product stock entry')
               .end();
        }

        break
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'POST', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
}