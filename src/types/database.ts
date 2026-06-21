// Hand-written types matching supabase/schema.sql
// Run `npx supabase gen types typescript` to auto-generate once you have a project linked.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          wallet_address: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          wallet_address: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
        };
      };
      trades: {
        Row: {
          id: string;
          user_wallet: string;
          token_mint: string;
          token_symbol: string;
          token_name: string;
          side: "buy" | "sell";
          sol_amount: number;
          token_amount: number;
          price_usd: number | null;
          tx_signature: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_wallet: string;
          token_mint: string;
          token_symbol: string;
          token_name: string;
          side: "buy" | "sell";
          sol_amount: number;
          token_amount: number;
          price_usd?: number | null;
          tx_signature: string;
          created_at?: string;
        };
        Update: never; // trades are immutable
      };
      watchlist: {
        Row: {
          id: string;
          user_wallet: string;
          token_mint: string;
          token_symbol: string | null;
          token_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_wallet: string;
          token_mint: string;
          token_symbol?: string | null;
          token_name?: string | null;
          created_at?: string;
        };
        Update: never;
      };
    };
  };
};
