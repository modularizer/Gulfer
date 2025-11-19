/**
 * Generated Type Declarations for Basic Schema Example
 * 
 * This file is auto-generated. Do not edit manually.
 * 
 * Generated at: 2025-11-19T00:12:44.663Z
 */

/**
 * UsersTableRecord - Record type for users table
 */
export type UsersTableRecord = {
  id: string;
  name: string | null;
  birthday: Date;
  gender: "male" | "female" | null;
  bio: string | null;
  headline: string | null;
};

/**
 * UsersTableInsert - Insert type for users table
 */
export type UsersTableInsert = {
  id?: string;
  name?: string | null;
  gender?: "male" | "female" | null;
  bio?: string | null;
  headline?: string | null;
  birthday: Date;
};

/**
 * PostsTableRecord - Record type for posts table
 */
export type PostsTableRecord = {
  author: string;
  postedAt: Date | null;
  content: string | null;
};

/**
 * PostsTableInsert - Insert type for posts table
 */
export type PostsTableInsert = {
  postedAt?: Date | null;
  content?: string | null;
  author: string;
};

