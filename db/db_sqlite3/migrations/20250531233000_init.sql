
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied
CREATE TABLE IF NOT EXISTS "users" ("id" integer primary key autoincrement, "username" varchar(255) NOT NULL UNIQUE, "hash" varchar(255), "api_key" varchar(255) NOT NULL UNIQUE, "password_change_required" boolean, "last_login" datetime, "account_locked" boolean);
CREATE TABLE IF NOT EXISTS "usbs" ("id" integer primary key autoincrement, "user_id" bigint, "name" varchar(255), "registered_date" datetime);
CREATE TABLE IF NOT EXISTS "targets" ("id" integer primary key autoincrement, "group_id" bigint, "api_key" varchar(255) NOT NULL UNIQUE, "hostname" varchar(255) NOT NULL, "os" varchar(255), "registered_date" datetime, "last_seen" datetime);
CREATE TABLE IF NOT EXISTS "results" ("id" integer primary key autoincrement, "campaign_id" bigint, "user_id" bigint, "target_id" bigint, "hostname" varchar(255) NOT NULL, "os" varchar(255), "username" varchar(255), "status" varchar(255) NOT NULL, "ip" varchar(255), "latitude" real, "longitude" real, "modified_date" datetime);
CREATE TABLE IF NOT EXISTS "groups" ("id" integer primary key autoincrement, "user_id" bigint, "name" varchar(255), "created_date" datetime, "modified_date" datetime);
CREATE TABLE IF NOT EXISTS "events" ("id" integer primary key autoincrement, "campaign_id" bigint, "hostname" varchar(255), "time" datetime, "message" varchar(255), "details" BLOB);
CREATE TABLE IF NOT EXISTS "campaigns" ("id" integer primary key autoincrement, "user_id" bigint, "name" varchar(255) NOT NULL, "created_date" datetime, "completed_date" datetime, "status" varchar(255));
CREATE TABLE IF NOT EXISTS "webhooks" ("id" integer primary key autoincrement, "name" varchar(255), "url" varchar(1000), "secret" varchar(255), "is_active" boolean default 0);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE "webhooks";
DROP TABLE "campaigns";
DROP TABLE "events";
DROP TABLE "groups";
DROP TABLE "results";
DROP TABLE "targets";
DROP TABLE "usbs";
DROP TABLE "users";