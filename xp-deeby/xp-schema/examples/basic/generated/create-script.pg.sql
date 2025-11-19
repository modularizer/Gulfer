-- Generated CREATE TABLE Script
-- 
-- This file is auto-generated. Do not edit manually.
-- 
-- Generated at: 2025-11-19T20:02:15.788Z
-- Dialect: pg
--

CREATE TABLE IF NOT EXISTS "users" (
	"id" VARCHAR(16),
	"name" TEXT,
	"birthday" TIMESTAMP NOT NULL,
	"gender" TEXT,
	CHECK ("gender" IN ('male','female')),
	"bio" TEXT,
	"headline" VARCHAR(23),
	PRIMARY KEY ("id"),
	UNIQUE ("name")
);

CREATE INDEX IF NOT EXISTS "user_name" ON "users" ("name");

CREATE TABLE IF NOT EXISTS "posts" (
	"id" VARCHAR(16),
	"author" TEXT NOT NULL,
	"posted_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	"content" VARCHAR(2000),
	PRIMARY KEY ("id"),
	FOREIGN KEY ("author") REFERENCES "users" ("name")
);