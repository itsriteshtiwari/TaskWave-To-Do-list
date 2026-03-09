# TaskWave-To-Do-list

# ⚡ TaskWave

TaskWave is a modern, full-stack task management application designed to help you stay productive. It features a sleek dark-mode UI with neon gradients, real-time task alarms, and an analytics dashboard to track your productivity.

## ✨ Features

- **🔐 Secure Authentication:** User registration and login using JWT (JSON Web Tokens) and bcrypt password hashing.
- **📝 Comprehensive Task Management:** Create, edit, delete, and mark tasks as completed.
- **🏷️ Organization:** Categorize tasks, assign priority levels (High, Medium, Low), and add custom tags.
- **⏰ Real-Time Alarms:** Set due dates and times. The app actively monitors your tasks and plays an audio alarm when a task is due!
- **📊 Analytics Dashboard:** Visual progress rings and breakdown of tasks by category and priority.
- **🔍 Search & Filter:** Easily search tasks by title or tags, and filter by status (Pending, Done, Overdue).
- **🎨 Modern UI/UX:** Custom-built glassmorphism design with a responsive layout.

## 🛠️ Tech Stack

**Frontend:**
- React.js (Hooks: `useState`, `useEffect`, `useRef`)
- Custom CSS (No external UI libraries)
- Web Audio API (for alarms)

**Backend:**
- FastAPI (Python)
- MySQL (via `pymysql`)
- OAuth2 with Password Bearer
- `bcrypt` for secure password hashing
- `python-jose` for JWT generation

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites
- Node.js installed
- Python 3.8+ installed
- MySQL Server running locally

### 1. Database Setup
Log into your MySQL server and create a database for the application:
```sql
CREATE DATABASE taskwave;
```
### 2. Backend Setup
Navigate to your backend directory and install the required Python packages:
> pip install fastapi uvicorn python-jose[cryptography] bcrypt pymysql python-multipart

Open main.py and update the DB_CONFIG dictionary with your actual MySQL username and password:

```DB_CONFIG = {
    "host": "localhost",
    "user": "root",          # <-- Your MySQL username
    "password": "password",  # <-- Your MySQL password
    "database": "taskwave",
    "cursorclass": pymysql.cursors.DictCursor
}```


