INSERT OR IGNORE INTO programs (code, name, category, default_points, default_start, default_end) VALUES
  ('NEWS-M', 'Morning News Bulletin',    'news',       2.0, '06:00', '07:00'),
  ('NEWS-E', 'Evening News Bulletin',    'news',       2.0, '18:00', '19:00'),
  ('MUSIC',  'Music Request Show',       'music',      1.5, '10:00', '12:00'),
  ('TALK',   'Live Talk Show',           'talk',       3.0, '20:00', '21:00'),
  ('SPORT',  'Sports Roundup',           'sports',     2.5, '21:00', '22:00'),
  ('SUDDEN', 'Sudden / Breaking Coverage','live_event',4.0, NULL,    NULL);

INSERT OR IGNORE INTO monthly_targets (employee_id, year, month, target_points)
VALUES ((SELECT employee_id FROM employees WHERE email = 'bob@example.com'),
        CAST(strftime('%Y', 'now') AS INTEGER),
        CAST(strftime('%m', 'now') AS INTEGER), 40.0);