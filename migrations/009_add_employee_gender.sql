ALTER TABLE employees
ADD COLUMN gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female'));
