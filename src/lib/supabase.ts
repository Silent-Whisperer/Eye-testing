import { createClient } from "@supabase/supabase-js";

// Read from build environment variables or fall back to user's Supabase URL
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://eehwpusvawqcuffpeujl.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl) {
  console.warn("VITE_SUPABASE_URL is not configured.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Error Handler Utility
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export function handleSupabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: SupabaseErrorInfo = {
    error: error instanceof Error ? error.message : JSON.stringify(error),
    authInfo: {
      userId: 'anonymous',
      email: 'none',
    },
    operationType,
    path
  };
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
