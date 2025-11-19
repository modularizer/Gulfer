-- Migration: 0001_initial
-- Hash: 229b8b5a1e86abde
-- Generated: 2025-11-19T20:02:15.806Z
-- Dialect: pg
--

CREATE TABLE "users" (
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

CREATE TABLE "posts" (
	"id" VARCHAR(16),
	"author" TEXT NOT NULL,
	"posted_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	"content" VARCHAR(2000),
	PRIMARY KEY ("id"),
	FOREIGN KEY ("author") REFERENCES "users" ("name")
);