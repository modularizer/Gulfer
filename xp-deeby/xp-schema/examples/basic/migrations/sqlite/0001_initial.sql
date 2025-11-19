-- Migration: 0001_initial
-- Hash: e29856edfc4340f2
-- Generated: 2025-11-19T19:11:17.636Z
-- Dialect: sqlite
--

CREATE TABLE "users" (
	"id" TEXT,
	"name" TEXT,
	"birthday" SQLiteTimestamp NOT NULL,
	"gender" TEXT('male','female'),
	"bio" TEXT,
	"headline" TEXT,
	PRIMARY KEY ("id"),
	UNIQUE ("name")
);

CREATE TABLE "posts" (
	"id" TEXT,
	"name" TEXT NOT NULL,
	"posted_at" SQLiteTimestamp DEFAULT CURRENT_TIMESTAMP,
	"content" TEXT,
	PRIMARY KEY ("id"),
	FOREIGN KEY ("name") REFERENCES "users" ("gender")
);