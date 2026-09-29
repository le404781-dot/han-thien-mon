-- Hàn Thiên Môn v3.7.54
-- Xóa vĩnh viễn toàn bộ Tiên Đế Hồng Mông Đan khỏi PostgreSQL.
BEGIN;

CREATE TEMP TABLE _hong_mong_dan_ids(id BIGINT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _hong_mong_dan_ids(id)
SELECT id FROM treasure_items
WHERE LOWER(TRIM(name)) = LOWER(TRIM('Tiên Đế Hồng Mông Đan'));

-- Dọn các FK RESTRICT trước.
DELETE FROM alchemy_recipe_ingredients
WHERE item_id IN (SELECT id FROM _hong_mong_dan_ids);

-- Dọn toàn bộ tồn kho của mọi môn nhân.
DELETE FROM inventory
WHERE item_id IN (SELECT id FROM _hong_mong_dan_ids);

-- Dọn tham chiếu nâng cấp/trang bị trực tiếp.
DELETE FROM immortal_artifact_enhancements
WHERE item_id IN (SELECT id FROM _hong_mong_dan_ids);

DELETE FROM spirit_beast_equipment
WHERE item_id IN (SELECT id FROM _hong_mong_dan_ids);

-- Xóa khỏi catalog; các FK CASCADE/SET NULL sẽ xử lý phần còn lại.
DELETE FROM treasure_items
WHERE id IN (SELECT id FROM _hong_mong_dan_ids);

COMMIT;

-- Kiểm tra: phải trả về 0 dòng.
SELECT id, name FROM treasure_items
WHERE LOWER(TRIM(name)) = LOWER(TRIM('Tiên Đế Hồng Mông Đan'));
