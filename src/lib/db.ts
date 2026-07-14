import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '@/db/schema';
import * as relations from '@/db/relations';

const uri = process.env.MYSQL_DATABASE_URL!;

// In a Cloudflare Worker environment, persisting a TCP connection pool
// across requests causes 'RefcountedFulfiller' errors because sockets 
// are bound to the request context that instantiated them.
// We detect if we're running in production (Cloudflare) to create connections per-query.
const isCloudflare = process.env.NODE_ENV === 'production';

let poolConnection: any;

if (isCloudflare) {
  // Create a proxy/fake pool that opens a new connection per query
  poolConnection = {
    async query(sql: string, values: any[]) {
      const conn = await mysql.createConnection(uri);
      try {
        return await conn.query(sql, values);
      } finally {
        await conn.end();
      }
    },
    async execute(sql: string, values: any[]) {
      const conn = await mysql.createConnection(uri);
      try {
        return await conn.execute(sql, values);
      } finally {
        await conn.end();
      }
    },
    async getConnection() {
      // Used by Drizzle for transactions
      const conn = await mysql.createConnection(uri);
      const originalRelease = (conn as any).release;
      (conn as any).release = () => {
        if (originalRelease) {
          try {
             originalRelease.call(conn);
          } catch (e) {}
        }
        conn.end();
      };
      return conn;
    }
  };
} else {
  // Use a standard connection pool for local development performance.
  // enableKeepAlive + keepAliveInitialDelay prevents ECONNRESET when the
  // server-side wait_timeout drops an idle TCP connection mid-session.
  poolConnection = mysql.createPool({
    uri,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,   // send first keepalive after 10 s
    connectTimeout: 30000,
  });
}

export const db = drizzle(poolConnection, { schema: { ...schema, ...relations }, mode: 'planetscale' });
