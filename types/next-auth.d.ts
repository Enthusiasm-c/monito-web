/**
 * NextAuth.js type extensions
 */

import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      isActive: boolean;
    }
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    isActive: boolean;
  }
}