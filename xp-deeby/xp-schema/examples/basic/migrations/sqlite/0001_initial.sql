-- Migration: 0001_initial
-- Hash: eb7f0c402fd0e5f4
-- Generated: 2025-11-19T20:02:15.801Z
-- Dialect: sqlite
--

CREATE TABLE "users" (
	"id" TEXT,
	"name" TEXT,
	"birthday" INTEGER NOT NULL,
	"gender" TEXT,
	CHECK ("gender" IN ('male','female')),
	"bio" TEXT,
	"headline" TEXT,
	PRIMARY KEY ("id"),
	UNIQUE ("name")
);

CREATE INDEX IF NOT EXISTS "user_name" ON "users" ("name");

CREATE TABLE "posts" (
	"id" TEXT,
	"author" TEXT NOT NULL,
	"posted_at" INTEGER DEFAULT (strftime('%s','now')),
	"content" TEXT,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("author") REFERENCES "users" ("name")
);