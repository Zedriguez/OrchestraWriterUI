-- Orchestra Visualizer data: profiles, projects, programs, server jobs, exports, activity.
--
-- These are new tables, but they live in a dated migration rather than schema/:
-- schema/*.sql runs before migrations/ on a fresh database, so the `app` schema
-- and auth.users (created by 20261022_01) would not exist yet.
--
-- Every row is owned by a user; deleting the auth.users row cascades to all of it.
-- The pipeline role (orchestra_worker) needs none of these tables, so no GRANTs.

-- Bytes per recording, for storage usage. Filled from S3 HeadObject at registration;
-- NULL for rows registered before this migration (usage counts them as 0).
ALTER TABLE app.audio_files ADD COLUMN bytes BIGINT CHECK (bytes >= 0);

-- ---------- profiles ----------
-- One row per user, created on the first GET /api/me. Name, email and image stay
-- in auth.users (Better Auth owns them); this holds what the app adds.
CREATE TABLE app.profiles (
    user_id     INTEGER     PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    handle      TEXT        NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
    role        TEXT        NOT NULL DEFAULT 'Music director',
    ensemble    TEXT        NOT NULL DEFAULT '',
    location    TEXT        NOT NULL DEFAULT '',
    bio         TEXT        NOT NULL DEFAULT '',
    website     TEXT,
    preferences JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- projects ----------
-- One score (+ optional recording) moving through Import -> Sync -> Customize -> Preview -> Export.
-- Score bytes, the recording and the parsed information map live in S3; keys are here.
CREATE TABLE app.projects (
    id               INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          INTEGER     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title            TEXT        NOT NULL DEFAULT 'Untitled project',
    subtitle         TEXT,
    composer         TEXT        NOT NULL DEFAULT '',
    movement         TEXT        NOT NULL DEFAULT '',
    score_filename   TEXT,
    score_key        TEXT        UNIQUE,
    score_bytes      BIGINT      CHECK (score_bytes >= 0),
    info_map_key     TEXT,
    audio_file_id    INTEGER     REFERENCES app.audio_files(id) ON DELETE SET NULL,
    audio_peaks      JSONB,
    parts            INTEGER     NOT NULL DEFAULT 0 CHECK (parts >= 0),
    measures         INTEGER     NOT NULL DEFAULT 0 CHECK (measures >= 0),
    duration_seconds REAL        NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    tempo            REAL,
    time_signature   TEXT,
    warnings         JSONB       NOT NULL DEFAULT '[]'::jsonb,
    thumbnail        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    stage            TEXT        NOT NULL DEFAULT 'import'
                                 CHECK (stage IN ('import', 'sync', 'customize', 'preview', 'export')),
    -- none: no score yet. running: parse-score job in flight. succeeded / failed: its outcome.
    parse_status     TEXT        NOT NULL DEFAULT 'none'
                                 CHECK (parse_status IN ('none', 'running', 'succeeded', 'failed')),
    parse_error      TEXT,
    parse_job_id     INTEGER,    -- FK added below, once app.jobs exists
    sync             JSONB,
    display          JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON app.projects (user_id, updated_at DESC);
CREATE INDEX ON app.projects (audio_file_id);

-- ---------- programs ----------
-- A concert program: an ordered list of the user's projects.
CREATE TABLE app.programs (
    id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    season      TEXT        NOT NULL DEFAULT '',
    date        DATE,
    venue       TEXT        NOT NULL DEFAULT '',
    description TEXT        NOT NULL DEFAULT '',
    color       TEXT        NOT NULL DEFAULT 'Strings'
                            CHECK (color IN ('Strings', 'Woodwinds', 'Brass', 'Percussion', 'Other')),
    notes       TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON app.programs (user_id);

-- Running order. Ownership comes through both sides (the API checks both belong
-- to the caller before writing), so there is no user_id here.
CREATE TABLE app.program_projects (
    program_id INTEGER NOT NULL REFERENCES app.programs(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
    position   INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (program_id, project_id)
);

CREATE INDEX ON app.program_projects (project_id);

-- ---------- jobs ----------
-- Server-side visualizer jobs (parse-score today). Polled by GET /api/jobs/:id.
-- Reuses app.job_status from the transcription pipeline migration.
CREATE TABLE app.jobs (
    id         INTEGER        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id INTEGER        REFERENCES app.projects(id) ON DELETE CASCADE,
    kind       TEXT           NOT NULL,
    status     app.job_status NOT NULL DEFAULT 'queued',
    progress   REAL           NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
    message    TEXT           NOT NULL DEFAULT '',
    result     JSONB,
    error      TEXT,
    created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX ON app.jobs (project_id);
CREATE INDEX ON app.jobs (user_id, created_at DESC);

ALTER TABLE app.projects
    ADD CONSTRAINT projects_parse_job_id_fkey
    FOREIGN KEY (parse_job_id) REFERENCES app.jobs(id) ON DELETE SET NULL;

-- ---------- exports ----------
-- History of MP4 and project-file exports. The file itself is in S3 under the project prefix.
CREATE TABLE app.exports (
    id         INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id INTEGER     NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
    kind       TEXT        NOT NULL CHECK (kind IN ('mp4', 'project')),
    filename   TEXT        NOT NULL,
    s3_key     TEXT        NOT NULL UNIQUE,
    bytes      BIGINT      NOT NULL DEFAULT 0 CHECK (bytes >= 0),
    resolution TEXT        CHECK (resolution IN ('720p', '1080p', '4k')),
    frame_rate INTEGER     CHECK (frame_rate IN (30, 60)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON app.exports (project_id, created_at DESC);
CREATE INDEX ON app.exports (user_id);

-- ---------- activity ----------
-- The "recent activity" feed: one line per import, sync save, display edit, export.
CREATE TABLE app.activity (
    id         INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id INTEGER     NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
    kind       TEXT        NOT NULL CHECK (kind IN ('import', 'sync', 'export', 'edit', 'share')),
    text       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON app.activity (user_id, created_at DESC);
CREATE INDEX ON app.activity (project_id, kind, created_at DESC);
