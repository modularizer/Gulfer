-- Generated CREATE TABLE Script
-- 
-- This file is auto-generated. Do not edit manually.
-- 
-- Generated at: 2025-11-19T17:43:28.668Z
-- Dialect: sqlite
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
	"id" TEXT PRIMARY KEY NOT NULL,
	"name" TEXT NOT NULL,
	"posted_at" INTEGER,
	"content" TEXT,
	FOREIGN KEY ("name") REFERENCES "users" ("gender")
);