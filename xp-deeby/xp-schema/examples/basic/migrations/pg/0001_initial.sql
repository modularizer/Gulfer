-- Migration: 0001_initial
-- Hash: e532f97a54f93681
-- Generated: 2025-11-19T19:11:17.639Z
-- Dialect: pg
--

CREATE TABLE "users" (
	"id" VARCHAR(16),
	"name" TEXT,
	"birthday" TIMESTAMP NOT NULL,
	"gender" TEXT('male','female'),
	"bio" TEXT,
	"headline" VARCHAR(23),
	PRIMARY KEY ("id"),
	UNIQUE ("name")
);

CREATE TABLE "posts" (
	"id" VARCHAR(16),
	"name" TEXT NOT NULL,
	"posted_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	"content" VARCHAR(2000),
	PRIMARY KEY ("id"),
	FOREIGN KEY ("name") REFERENCES "users" ("gender")
);