-- Generated CREATE TABLE Script for Basic Schema Example
-- 
-- This file is auto-generated. Do not edit manually.
-- 
-- Generated at: 2025-11-19T01:57:05.880Z
-- Dialect: SQLite
--

CREATE TABLE IF NOT EXISTS "users" (
	"id" TEXT PRIMARY KEY NOT NULL,
	"name" TEXT UNIQUE,
	"birthday" INTEGER NOT NULL,
	"gender" TEXT,
	"bio" TEXT,
	"headline" TEXT
);

CREATE TABLE IF NOT EXISTS "posts" (
	"name" TEXT NOT NULL,
	"posted_at" INTEGER,
	"content" TEXT,
	FOREIGN KEY ("name") REFERENCES "users" ("gender")
);