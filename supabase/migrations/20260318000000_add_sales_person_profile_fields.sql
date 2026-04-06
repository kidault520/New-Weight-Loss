-- 销售人员扩展档案字段：出生年月、性别、民族、学历、身份证号、工作履历、账号状态
ALTER TABLE sales_persons
  ADD COLUMN IF NOT EXISTS birth_date text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS ethnicity text,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS work_history text,
  ADD COLUMN IF NOT EXISTS account_status text CHECK (account_status IN ('未激活', '激活', '禁用'));

COMMENT ON COLUMN sales_persons.birth_date IS '出生年月 YYYY-MM';
COMMENT ON COLUMN sales_persons.gender IS '性别';
COMMENT ON COLUMN sales_persons.ethnicity IS '民族';
COMMENT ON COLUMN sales_persons.education IS '学历';
COMMENT ON COLUMN sales_persons.id_number IS '身份证号';
COMMENT ON COLUMN sales_persons.work_history IS '之前工作履历';
COMMENT ON COLUMN sales_persons.account_status IS '账号状态：未激活/激活/禁用（禁用后无法登录）';
