import { createContext, useContext, type ReactNode } from 'react';
import type { User } from '@/types/user';

interface UserContextValue {
  currentUser: User | null;
}

const UserContext = createContext<UserContextValue>({ currentUser: null });

export function UserProvider({ user, children }: { user: User | null; children: ReactNode }) {
  return <UserContext.Provider value={{ currentUser: user }}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): User | null {
  return useContext(UserContext).currentUser;
}
