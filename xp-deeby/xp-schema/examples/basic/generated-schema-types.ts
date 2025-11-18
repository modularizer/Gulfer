/**
 * Generated Type Declarations for Basic Schema Example
 * 
 * This file is auto-generated. Do not edit manually.
 * 
 * Generated at: 2025-11-18T23:40:39.553Z
 */

/**
 * UsersSelect - Select type for users table
 */
export type UsersSelect = {
  readonly id: string;
  readonly name: string | null;
  readonly birthday: Date;
  readonly gender: "male" | "female" | null;
  readonly bio: string | null;
  readonly headline: string | null;
};

/**
 * UsersInsert - Insert type for users table
 */
export type UsersInsert = {
  readonly birthday: Date;
  } & { readonly id?: string | undefined;
  readonly name?: string | null | undefined;
  readonly gender?: "male" | "female" | null | undefined;
  readonly bio?: string | null | undefined;
  readonly headline?: string | null | undefined;
};

/**
 * PostsSelect - Select type for posts table
 */
export type PostsSelect = {
  readonly author: string;
  readonly postedAt: Date | null;
  readonly content: string | null;
};

/**
 * PostsInsert - Insert type for posts table
 */
export type PostsInsert = {
  readonly author: string;
  } & { readonly postedAt?: Date | null | undefined;
  readonly content?: string | null | undefined;
};

