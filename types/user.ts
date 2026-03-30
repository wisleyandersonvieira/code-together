export interface User {
  id: string; // UUID from auth.users
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  legacy_user_id?: number;
  created_at?: string;
  updated_at?: string;
}
