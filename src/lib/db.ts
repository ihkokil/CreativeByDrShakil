import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration URLs and Anon Keys for all 5 dynamic instances
const dbConfigs = [
  { url: process.env.SUPABASE_URL_1!, anonKey: process.env.SUPABASE_ANON_KEY_1! },
  { url: process.env.SUPABASE_URL_2!, anonKey: process.env.SUPABASE_ANON_KEY_2! },
  { url: process.env.SUPABASE_URL_3!, anonKey: process.env.SUPABASE_ANON_KEY_3! },
  { url: process.env.SUPABASE_URL_4!, anonKey: process.env.SUPABASE_ANON_KEY_4! },
  { url: process.env.SUPABASE_URL_5!, anonKey: process.env.SUPABASE_ANON_KEY_5! },
];

// Backup database configuration
const backupConfig = {
  url: process.env.SUPABASE_URL!,       // Primary backup URL
  anonKey: process.env.SUPABASE_ANON_KEY! // Primary backup anon key
};

// Timeout fetch wrapper (fail-fast rule)
function fetchWithTimeout(ms = 8000) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

// Pre-initialize and cache dynamic clients
const supabaseClients = dbConfigs.map(config => 
  createClient(config.url, config.anonKey, {
    global: {
      fetch: fetchWithTimeout(8000),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
);

// Pre-initialize and cache the backup client
const backupClient = createClient(backupConfig.url, backupConfig.anonKey, {
  global: {
    fetch: fetchWithTimeout(8000),
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Helper to get active database index based on current GMT+6 time (offset by 4 hours)
export function getActiveDbIndex(): number {
  const now = new Date();
  
  // Convert to GMT+6 (Bangladesh Standard Time is UTC+6)
  const gmt6Time = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  
  // Subtract 4 hours to shift the day rollover to 4:00 AM GMT+6
  const dbTime = new Date(gmt6Time.getTime() - (4 * 60 * 60 * 1000));
  const day = dbTime.getUTCDate(); // Day of month (1-31)

  const rem = day % 5;
  return rem === 0 ? 4 : rem - 1;
}

// Get the current active Supabase client wrapped in a dynamic double-writing proxy
export function getSupabase(): SupabaseClient {
  const activeIndex = getActiveDbIndex();
  const activeClient = supabaseClients[activeIndex];

  return new Proxy(activeClient, {
    get(target, prop, receiver) {
      
      // 1. Intercept table queries: supabase.from('table_name')
      if (prop === 'from') {
        return (tableName: string) => {
          const activeBuilder = activeClient.from(tableName);
          const backupBuilder = backupClient.from(tableName);

          // Return a proxy over the Query Builder
          return new Proxy(activeBuilder, {
            get(builderTarget, builderProp) {
              const originalMethod = (builderTarget as any)[builderProp];

              // If it's a mutating query method (insert, update, delete, upsert)
              if (['insert', 'update', 'delete', 'upsert'].includes(builderProp as string)) {
                return (...args: any[]) => {
                  const activePromise = Promise.resolve((activeBuilder as any)[builderProp](...args));
                  const backupPromise = Promise.resolve((backupBuilder as any)[builderProp](...args));

                  // Intercept resolution to execute both in parallel
                  return {
                    then: async (onfulfilled: any, onrejected: any) => {
                      try {
                        const [activeRes] = await Promise.all([
                          activePromise,
                          backupPromise.catch((err: any) => {
                            // Suppress backup errors to ensure high availability of active DB
                            console.error(`[WARNING] Backup DB write failed for table '${tableName}':`, err);
                            return null;
                          })
                        ]);
                        return onfulfilled ? onfulfilled(activeRes) : activeRes;
                      } catch (err) {
                        return onrejected ? onrejected(err) : Promise.reject(err);
                      }
                    }
                  };
                };
              }

              // Return standard read methods (select, etc.) directly from active DB
              return typeof originalMethod === 'function' ? originalMethod.bind(activeBuilder) : originalMethod;
            }
          });
        };
      }

      // 2. Intercept custom postgres RPC function calls: supabase.rpc('function_name')
      if (prop === 'rpc') {
        return (fnName: string, params?: any) => {
          const activePromise = Promise.resolve(activeClient.rpc(fnName, params));
          const backupPromise = Promise.resolve(backupClient.rpc(fnName, params));

          return {
            then: async (onfulfilled: any, onrejected: any) => {
              try {
                const [activeRes] = await Promise.all([
                  activePromise,
                  backupPromise.catch((err: any) => {
                    console.error(`[WARNING] Backup DB RPC call '${fnName}' failed:`, err);
                    return null;
                  })
                ]);
                return onfulfilled ? onfulfilled(activeRes) : activeRes;
              } catch (err) {
                return onrejected ? onrejected(err) : Promise.reject(err);
              }
            }
          };
        };
      }

      // For auth, storage, and other standard client APIs, return the active instance directly
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}
