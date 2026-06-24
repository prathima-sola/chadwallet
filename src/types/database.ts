// Hand-written types matching supabase/schema.sql
// Run `npx supabase gen types typescript` to auto-generate once you have a project linked.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          wallet_address: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          wallet_address?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          wallet_address?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
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
          user_id: string;
          user_wallet: string;
          token_mint: string;
          token_symbol: string;
          token_name: string;
          side: "buy" | "sell";
          sol_amount: number | string;
          token_amount: number | string;
          price_usd?: number | string | null;
          tx_signature: string;
          created_at?: string;
        };
        Update: never; // trades are immutable
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
