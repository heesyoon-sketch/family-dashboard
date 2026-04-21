-- users 테이블에서 이름 중복 제거 (created_at 가장 오래된 행만 유지)
DELETE FROM users WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (name) id FROM users ORDER BY name, created_at ASC
  ) subq
);
