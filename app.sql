-- CREATE TABLE  users (
--     id TEXT PRIMARY KEY,
--     name TEXT NOT NULL,
--     email TEXT NOT NULL UNIQUE,
--     password TEXT NOT NULL
-- -- );

-- delete from  users;

-- drop table users;


-- INSERT INTO  users(id,name,email,password)
-- VALUES ('aa12','mounika','mounika@gmail.com','mounika12');

-- Create Tasks table

CREATE TABLE IF NOT EXISTS tasks(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK( status IN ('pending','in progress','done','completed') ) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- drop table tasks;

-- delete from tasks;