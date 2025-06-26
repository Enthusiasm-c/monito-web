/**
 * User Service for authentication and user management
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'manager', 'viewer']).default('viewer')
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email format').optional(),
  role: z.enum(['admin', 'manager', 'viewer']).optional(),
  isActive: z.boolean().optional()
});

export type CreateUserData = z.infer<typeof CreateUserSchema>;
export type LoginData = z.infer<typeof LoginSchema>;
export type UpdateUserData = z.infer<typeof UpdateUserSchema>;

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithoutPassword extends Omit<User, 'password'> {}

export class UserService {
  /**
   * Create a new user with hashed password
   */
  async createUser(userData: CreateUserData): Promise<UserWithoutPassword> {
    try {
      // Validate input
      const validatedData = CreateUserSchema.parse(userData);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(validatedData.password, saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          password: hashedPassword,
          role: validatedData.role,
          isActive: true
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      console.log(`User created: ${user.email} with role ${user.role}`);
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  async authenticateUser(loginData: LoginData): Promise<UserWithoutPassword | null> {
    try {
      // Validate input
      const validatedData = LoginSchema.parse(loginData);

      // Find user
      const user = await prisma.user.findUnique({
        where: { 
          email: validatedData.email,
          isActive: true 
        }
      });

      if (!user) {
        return null;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
      
      if (!isPasswordValid) {
        return null;
      }

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      console.log(`User authenticated: ${user.email}`);
      return userWithoutPassword;
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserWithoutPassword | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return user;
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserWithoutPassword | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return user;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  }

  /**
   * Update user data
   */
  async updateUser(id: string, updateData: UpdateUserData): Promise<UserWithoutPassword> {
    try {
      // Validate input
      const validatedData = UpdateUserSchema.parse(updateData);

      // Check if email is being changed and if it's unique
      if (validatedData.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: validatedData.email,
            NOT: { id }
          }
        });

        if (existingUser) {
          throw new Error('Email is already in use by another user');
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: validatedData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      console.log(`User updated: ${user.email}`);
      return user;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Validate new password length
      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters');
      }

      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await prisma.user.update({
        where: { id },
        data: { password: hashedNewPassword }
      });

      console.log(`Password changed for user: ${user.email}`);
      return true;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(page: number = 1, limit: number = 50): Promise<{
    users: UserWithoutPassword[];
    total: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.user.count()
      ]);

      return {
        users,
        total,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(id: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id },
        data: { isActive: false }
      });

      console.log(`User deactivated: ${id}`);
      return true;
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }

  /**
   * Activate user
   */
  async activateUser(id: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id },
        data: { isActive: true }
      });

      console.log(`User activated: ${id}`);
      return true;
    } catch (error) {
      console.error('Error activating user:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission for action
   */
  hasPermission(userRole: string, requiredRole: string): boolean {
    const roleHierarchy = {
      'viewer': 1,
      'manager': 2,
      'admin': 3
    };

    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 999;

    return userLevel >= requiredLevel;
  }

  /**
   * Update admin user password (for migration script)
   */
  async updateAdminPassword(email: string, newPassword: string): Promise<boolean> {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
      });

      console.log(`Admin password updated for: ${email}`);
      return true;
    } catch (error) {
      console.error('Error updating admin password:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userService = new UserService();