"""
TaskWave Backend — FastAPI + MySQL
Run: uvicorn main:app --reload
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import bcrypt
from jose import JWTError, jwt
import pymysql
import pymysql.cursors
import uuid
import json

# ─── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY  = "taskwave-secret-change-in-production"
ALGORITHM   = "HS256"
TOKEN_EXPIRY = 60 * 24  # minutes

DB_CONFIG = {
    "host": "localhost",
    "user": "root",          # <-- Change to your MySQL user
    "password": "password",  # <-- Change to your MySQL password
    "database": "taskwave",
    "cursorclass": pymysql.cursors.DictCursor
}

app = FastAPI(title="TaskWave API", version="1.0.0")

# Allow the React frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], # Change to ["http://localhost:5173"] in production
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

oauth2  = OAuth2PasswordBearer(tokenUrl="auth/login")

# ─── Database ─────────────────────────────────────────────────────────────────
def get_db():
    return pymysql.connect(**DB_CONFIG)

def init_db():
    db = get_db()
    with db.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id       VARCHAR(36) PRIMARY KEY,
                name     VARCHAR(255) NOT NULL,
                email    VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created  DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id        VARCHAR(36) PRIMARY KEY,
                user_id   VARCHAR(36) NOT NULL,
                title     VARCHAR(255) NOT NULL,
                note      TEXT,
                category  VARCHAR(100) DEFAULT 'Other 🗂️',
                priority  VARCHAR(50) DEFAULT 'med',
                due       VARCHAR(100),
                done      BOOLEAN DEFAULT FALSE,
                tags      JSON,
                created   DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
    db.commit()
    db.close()

init_db()

# ─── Schemas ──────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    name:  str
    email: str
    password: str

class UserOut(BaseModel):
    id: str; name: str; email: str; created: str

class Token(BaseModel):
    access_token: str; token_type: str; user: UserOut

class TaskCreate(BaseModel):
    title:    str
    note:     Optional[str] = ""
    category: Optional[str] = "Other 🗂️"
    priority: Optional[str] = "med"
    due:      Optional[str] = None
    done:     Optional[bool] = False
    tags:     Optional[List[str]] = []

class TaskOut(TaskCreate):
    id: str; user_id: str; created: str; updated: str

# ─── Auth Helpers ─────────────────────────────────────────────────────────────
def hash_pw(pw: str) -> str:
    # bcrypt requires passwords to be bytes, so we encode to utf-8
    salt = bcrypt.gensalt()
    hashed_pw = bcrypt.hashpw(pw.encode('utf-8'), salt)
    # decode back to string so it can be saved in MySQL
    return hashed_pw.decode('utf-8')

def verify_pw(plain: str, hashed: str) -> bool:
    try:
        # Both the plain password and the stored hash need to be bytes for checking
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except ValueError:
        return False

def create_token(data: dict):
    exp = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRY)
    return jwt.encode({**data, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id: raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = get_db()
    with db.cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()
    db.close()
    
    if not user: raise HTTPException(status_code=401, detail="User not found")
    # Convert datetime objects to strings for JSON serialization
    user["created"] = str(user["created"])
    return user

# ─── Auth Routes ─────────────────────────────────────────────────────────────
@app.post("/auth/register", response_model=Token)
def register(data: UserCreate):
    db = get_db()
    with db.cursor() as cursor:
        cursor.execute("SELECT id FROM users WHERE email=%s", (data.email,))
        if cursor.fetchone():
            db.close(); raise HTTPException(400, "Email already registered")

        uid = str(uuid.uuid4())
        cursor.execute("INSERT INTO users (id, name, email, password) VALUES (%s,%s,%s,%s)",
                       (uid, data.name, data.email, hash_pw(data.password)))
        db.commit()
        
        cursor.execute("SELECT * FROM users WHERE id=%s", (uid,))
        user = cursor.fetchone()
    db.close()
    
    token = create_token({"sub": uid})
    user["created"] = str(user["created"])
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/auth/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    with db.cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE email=%s", (form.username,))
        user = cursor.fetchone()
    db.close()
    
    if not user or not verify_pw(form.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")
        
    token = create_token({"sub": user["id"]})
    user["created"] = str(user["created"])
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.get("/auth/me", response_model=UserOut)
def me(current = Depends(get_current_user)):
    return current

# ─── Task Routes ─────────────────────────────────────────────────────────────
@app.get("/tasks", response_model=List[TaskOut])
def list_tasks(current = Depends(get_current_user)):
    db = get_db()
    with db.cursor() as cursor:
        cursor.execute("SELECT * FROM tasks WHERE user_id=%s ORDER BY created DESC", (current["id"],))
        rows = cursor.fetchall()
    db.close()

    tasks = []
    for r in rows:
        # Parse JSON and boolean fields for Pydantic
        r["tags"] = json.loads(r["tags"]) if isinstance(r["tags"], str) else (r["tags"] or [])
        r["done"] = bool(r["done"])
        r["created"] = str(r["created"])
        r["updated"] = str(r["updated"])
        tasks.append(r)

    return tasks

@app.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(data: TaskCreate, current = Depends(get_current_user)):
    db = get_db()
    tid = str(uuid.uuid4())
    tags_json = json.dumps(data.tags)
    
    with db.cursor() as cursor:
        cursor.execute("""
            INSERT INTO tasks (id, user_id, title, note, category, priority, due, done, tags) 
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (tid, current["id"], data.title, data.note, data.category, data.priority, data.due, int(data.done), tags_json))
        db.commit()
        
        cursor.execute("SELECT * FROM tasks WHERE id=%s", (tid,))
        row = cursor.fetchone()
    db.close()
    
    row["tags"] = json.loads(row["tags"]) if isinstance(row["tags"], str) else (row["tags"] or [])
    row["done"] = bool(row["done"])
    row["created"] = str(row["created"])
    row["updated"] = str(row["updated"])
    return row

@app.put("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: str, data: TaskCreate, current = Depends(get_current_user)):
    db = get_db()
    tags_json = json.dumps(data.tags)
    
    with db.cursor() as cursor:
        cursor.execute("SELECT * FROM tasks WHERE id=%s AND user_id=%s", (task_id, current["id"]))
        if not cursor.fetchone(): 
            db.close(); raise HTTPException(404, "Task not found")
            
        cursor.execute("""
            UPDATE tasks SET title=%s, note=%s, category=%s, priority=%s, due=%s, done=%s, tags=%s 
            WHERE id=%s
        """, (data.title, data.note, data.category, data.priority, data.due, int(data.done), tags_json, task_id))
        db.commit()
        
        cursor.execute("SELECT * FROM tasks WHERE id=%s", (task_id,))
        row = cursor.fetchone()
    db.close()
    
    row["tags"] = json.loads(row["tags"]) if isinstance(row["tags"], str) else (row["tags"] or [])
    row["done"] = bool(row["done"])
    row["created"] = str(row["created"])
    row["updated"] = str(row["updated"])
    return row

@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, current = Depends(get_current_user)):
    db = get_db()
    with db.cursor() as cursor:
        cursor.execute("DELETE FROM tasks WHERE id=%s AND user_id=%s", (task_id, current["id"]))
    db.commit()
    db.close()
