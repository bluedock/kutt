const Redis = require("ioredis");
const dns = require("node:dns");

const env = require("./env");

let client;

if (env.REDIS_ENABLED) {
  // Resolve hostname to handle cases without A-record (Issue #1020)
  const resolveRedisHost = () => {
    return new Promise((resolve, reject) => {
      dns.lookup(env.REDIS_HOST, { family: 4 }, (err, address) => {
        if (err) {
          // Fallback to using hostname directly (ioredis will handle it)
          console.warn(`Redis DNS lookup failed for ${env.REDIS_HOST}, using hostname directly:`, err.message);
          resolve(env.REDIS_HOST);
        } else {
          resolve(address);
        }
      });
    });
  };

  // Initialize with retry strategy and proper connection handling
  const initRedis = async () => {
    const host = await resolveRedisHost();
    client = new Redis({
      host,
      port: env.REDIS_PORT,
      db: env.REDIS_DB,
      ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
      // Connection retry strategy
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('Redis max reconnection attempts reached');
          return null; // Stop retrying
        }
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms... max 30s
        return Math.min(times * 100, 30000);
      },
      // Reconnect on error
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      // Connection pool settings
      family: 4,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    client.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    client.on('connect', () => {
      console.log('Redis connected successfully');
    });

    client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    try {
      await client.connect();
    } catch (err) {
      console.error('Failed to connect to Redis:', err.message);
    }
  };

  initRedis();
}

const key = {
  link: (address, domain_id) => `l:${address}:${domain_id || ""}`,
  domain: (address) => `d:${address}`,
  stats: (link_id) => `s:${link_id}`,
  host: (address) => `h:${address}`,
  user: (idOrKey) => `u:${idOrKey}`
};

const remove = {
  domain: (domain) => {
    if (!domain) return;
    return client.del(key.domain(domain.address));
  },
  host: (host) => {
    if (!host) return;
    return client.del(key.host(host.address));
  },
  link: (link) => {
    if (!link) return;
    return client.del(key.link(link.address, link.domain_id));
  },
  user: (user) => {
    if (!user) return;
    return Promise.all([
      client.del(key.user(user.id)),
      client.del(key.user(user.apikey)),
    ]);
  }
};


module.exports = {
  client,
  key,
  remove,
}