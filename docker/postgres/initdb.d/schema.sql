CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;

SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

DROP TABLE IF EXISTS oauth_authorization_codes;
CREATE TABLE oauth_authorization_codes
(
    id                 uuid                        NOT NULL PRIMARY KEY,
    authorization_code text                        NOT NULL,
    expires_at         timestamp without time zone NOT NULL,
    client_id          text                        NOT NULL,
    user_id            uuid                        NOT NULL,
    revoked            bool                        NOT NULL DEFAULT (false)
);


DROP TABLE IF EXISTS oauth_tokens;
CREATE TABLE oauth_tokens
(
    id                       uuid                        NOT NULL PRIMARY KEY,
    access_token             text                        NOT NULL,
    access_token_expires_at  timestamp without time zone NOT NULL,
    client_id                text                        NOT NULL,
    refresh_token            text                        NOT NULL,
    refresh_token_expires_at timestamp without time zone NOT NULL,
    user_id                  uuid                        NOT NULL,
    revoked                  bool                        NOT NULL DEFAULT (false)
);

--
-- Name: oauth_clients; Type: TABLE; Schema: public; Owner: -; Tablespace:
--

DROP TABLE IF EXISTS oauth_clients;
CREATE TABLE oauth_clients
(
    client_id     text NOT NULL,
    client_secret text NOT NULL,
    redirect_uri  text NOT NULL
);

ALTER TABLE ONLY oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (client_id, client_secret);

-- TODO: Uncomment this to add the google client back
-- INSERT INTO oauth_clients (client_id, client_secret, redirect_uri)
-- VALUES ('eb47ecec86884e029ac626bd5de45d92', '784bcfc776104cac85145ba834c30020',
--         'https://oauth-redirect.googleusercontent.com/r/esp32-iot-desk-b8329');

DROP TABLE IF EXISTS users;
CREATE TABLE users
(
    id       uuid NOT NULL PRIMARY KEY,
    email    text NOT NULL,
    password text NOT NULL
);

CREATE INDEX users_email_password ON users USING btree (email, password);

CREATE TABLE devices
(
    id      uuid NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL,
    current_height text NOT NULL
);

-- TODO: Uncomment this to insert the device so it is the same between local and remote
-- INSERT INTO devices (id, user_id, current_height) VALUES ('77078ff2-0684-11eb-a8e7-0242ac130002', 'a906dfb0-05aa-11eb-b8d0-0242ac130002', 'preset one');
