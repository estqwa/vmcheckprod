BEGIN;

-- ad_assets: справочник рекламных медиа-файлов
CREATE TABLE IF NOT EXISTS ad_assets (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(100) NOT NULL,
    media_type      VARCHAR(16) NOT NULL CHECK (media_type IN ('image', 'video')),
    url             VARCHAR(1024) NOT NULL,
    thumbnail_url   VARCHAR(1024),
    duration_sec    INT NOT NULL DEFAULT 10 CHECK (duration_sec >= 3 AND duration_sec <= 30),
    file_size_bytes BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- quiz_ad_slots: привязка рекламы к вопросу викторины
CREATE TABLE IF NOT EXISTS quiz_ad_slots (
    id              SERIAL PRIMARY KEY,
    quiz_id         INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_after  INT NOT NULL CHECK (question_after >= 1),
    ad_asset_id     INT NOT NULL REFERENCES ad_assets(id) ON DELETE RESTRICT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (quiz_id, question_after)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_quiz_ad_slots_quiz_id ON quiz_ad_slots(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_ad_slots_ad_asset_id ON quiz_ad_slots(ad_asset_id);

COMMIT;
