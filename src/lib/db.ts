import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Configuration URLs, Anon Keys, and Service Role Keys for all 5 dynamic instances
const dbConfigs = [
  {
    url: process.env.SUPABASE_URL_1!,
    anonKey: process.env.SUPABASE_ANON_KEY_1!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_1 || process.env.SUPABASE_ANON_KEY_1!
  },
  {
    url: process.env.SUPABASE_URL_2!,
    anonKey: process.env.SUPABASE_ANON_KEY_2!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_2 || process.env.SUPABASE_ANON_KEY_2!
  },
  {
    url: process.env.SUPABASE_URL_3!,
    anonKey: process.env.SUPABASE_ANON_KEY_3!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_3 || process.env.SUPABASE_ANON_KEY_3!
  },
  {
    url: process.env.SUPABASE_URL_4!,
    anonKey: process.env.SUPABASE_ANON_KEY_4!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_4 || process.env.SUPABASE_ANON_KEY_4!
  },
  {
    url: process.env.SUPABASE_URL_5!,
    anonKey: process.env.SUPABASE_ANON_KEY_5!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY_5 || process.env.SUPABASE_ANON_KEY_5!
  },
];

// Backup database configuration
const backupConfig = {
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
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

// Pre-initialize and cache dynamic clients (standard/anon and admin/service role)
const supabaseClients = dbConfigs.map(config => 
  createClient<any>(config.url, config.anonKey, {
    global: {
      fetch: fetchWithTimeout(8000),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
);

const supabaseAdminClients = dbConfigs.map(config => 
  createClient<any>(config.url, config.serviceKey, {
    global: {
      fetch: fetchWithTimeout(8000),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
);

// Pre-initialize and cache the backup clients
const backupClient = createClient<any>(backupConfig.url, backupConfig.anonKey, {
  global: {
    fetch: fetchWithTimeout(8000),
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const backupAdminClient = createClient<any>(backupConfig.url, backupConfig.serviceKey, {
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

// Helper to create a proxy that mirrors mutating actions to the backup database
function createDoubleWriteProxy(activeClient: SupabaseClient<any>, backupClient: SupabaseClient<any>): SupabaseClient<any> {
  return new Proxy(activeClient, {
    get(target, prop, receiver) {
      // 1. Intercept table queries: supabase.from('table_name')
      if (prop === 'from') {
        return (tableName: string) => {
          const activeBuilder = activeClient.from(tableName);
          const backupBuilder = backupClient.from(tableName);

          function wrapBuilder(activeB: any, backupB: any, isMutation = false): any {
            return new Proxy(activeB, {
              get(bTarget, bProp) {
                if (bProp === 'then') {
                  return (onfulfilled: any, onrejected: any) => {
                    const activePromise = Promise.resolve(activeB.then());
                    if (isMutation) {
                      const backupPromise = Promise.resolve(backupB.then()).catch(err => {
                        console.error(`[WARNING] Backup DB write failed for table '${tableName}':`, err);
                        return null;
                      });
                      return Promise.all([activePromise, backupPromise])
                        .then(([activeRes]) => onfulfilled ? onfulfilled(activeRes) : activeRes)
                        .catch(err => onrejected ? onrejected(err) : Promise.reject(err));
                    }
                    return activePromise.then(onfulfilled).catch(onrejected);
                  };
                }
                
                const originalMethod = bTarget[bProp];
                if (typeof originalMethod === 'function') {
                  return (...args: any[]) => {
                    const nextIsMutation = isMutation || ['insert', 'update', 'delete', 'upsert'].includes(bProp as string);
                    const newActiveB = originalMethod.apply(activeB, args);
                    const newBackupB = backupB[bProp] ? backupB[bProp].apply(backupB, args) : backupB;
                    
                    if (newActiveB && typeof newActiveB.then === 'function') {
                      return wrapBuilder(newActiveB, newBackupB, nextIsMutation);
                    }
                    return newActiveB;
                  };
                }
                return originalMethod;
              }
            });
          }
          
          return wrapBuilder(activeBuilder, backupBuilder);
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

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

// Get the current active client wrapped in a dynamic double-writing proxy
// We use the admin client (Service Role) here to globally bypass RLS,
// which matches the previous Drizzle behavior where the raw postgres connection bypassed RLS.
// Application-level security is enforced in the API routes.
export function getSupabase(): SupabaseClient<any> {
  const activeIndex = getActiveDbIndex();
  const activeClient = supabaseAdminClients[activeIndex];
  return createDoubleWriteProxy(activeClient, backupAdminClient);
}

// Keep getSupabaseAdmin for backwards compatibility where it was explicitly imported
export function getSupabaseAdmin(): SupabaseClient<any> {
  return getSupabase();
}
