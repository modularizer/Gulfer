-- Generated CREATE TABLE Script
-- 
-- This file is auto-generated. Do not edit manually.
-- 
-- Generated at: 2025-11-19T19:11:17.622Z
-- Dialect: pg
--

CREATE TABLE IF NOT EXISTS "users" (
	"id" VARCHAR(16) PRIMARY KEY NOT NULL,
	"name" TEXT UNIQUE,
	"birthday" TIMESTAMP NOT NULL,
	"gender" VARCHAR,
	"bio" TEXT,
	"headline" VARCHAR(23)
);

CREATE INDEX IF NOT EXISTS "user_name" ON "users" ("name");

CREATE TABLE IF NOT EXISTS "posts" (
	"id" VARCHAR(16) PRIMARY KEY NOT NULL,
	"name" TEXT NOT NULL,
	"posted_at" TIMESTAMP,
	"content" VARCHAR(2000),
	FOREIGN KEY ("name") REFERENCES "users" ("gender") ON UPDATE no action ON DELETE no action
);