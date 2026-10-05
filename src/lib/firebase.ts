/**
 * Authoritative Supabase Integration Stubs
 * Firebase has been completely replaced with Supabase PostgreSQL & Supabase Auth.
 */
export const auth: any = {
  currentUser: null,
  onAuthStateChanged: (_cb: any) => {
    return () => {};
  },
};

export const googleProvider: any = {};

export const db: any = {};

const app: any = {};
export default app;


