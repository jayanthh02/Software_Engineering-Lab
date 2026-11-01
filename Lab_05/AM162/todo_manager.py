"""To-do list and task manager.

Adds tasks with a priority, marks them complete, lists pending tasks in
priority order, searches by keyword, suggests a task to do next, and saves
tasks to JSON files.
"""
import json
import re
import smtplib
from datetime import datetime
from email.message import EmailMessage

tasks = {}
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def add_task(title, priority="medium", labels=None):
    """Add a task and return its id. Labels are stored with the task."""
    if priority not in PRIORITY_ORDER:
        raise ValueError(f"Unknown priority: {priority}")
    task_id = max(tasks, default=0) + 1
    tasks[task_id] = {"title": title, "priority": priority, "done": False,
                      "labels": list(labels or []),
                      "created": datetime.now().isoformat()}
    return task_id


def complete_task(task_id):
    """Mark a task as done. Returns False if the id does not exist."""
    if task_id in tasks:
        tasks[task_id]["done"] = True
        return True
    print("No task with id", task_id)
    return False


def pending_tasks():
    """Return the titles of unfinished tasks, highest priority first."""
    pending = [task for task in tasks.values() if not task["done"]]
    pending.sort(key=lambda task: PRIORITY_ORDER[task["priority"]])
    return [task["title"] for task in pending]


def find_task(keyword):
    """Return the id of the first task whose title contains the keyword, or None."""
    for task_id, task in tasks.items():
        if keyword.lower() in task["title"].lower():
            return task_id
    return None



def save_tasks(file_name="tasks_data.json"):
    """Save all tasks to a JSON file."""
    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(tasks, f)


def load_tasks(file_name="tasks_data.json"):
    """Load tasks from a JSON file written by save_tasks."""
    with open(file_name, "r", encoding="utf-8") as f:
        data = json.load(f)
    # JSON object keys are always strings; task ids are ints.
    return {int(task_id): task for task_id, task in data.items()}


def export_json(file_name="tasks.json"):
    """Write all tasks to a readable, indented JSON file."""
    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=2)


def remind_by_email(address):
    """Email the task list to the address through a local SMTP server."""
    # Helper kept for the lab: not called by the demo
    if not EMAIL_PATTERN.match(address):
        raise ValueError(f"Invalid email address: {address}")
    message = EmailMessage()
    message["Subject"] = "Pending tasks"
    message["To"] = address
    message.set_content(json.dumps(tasks, indent=2))
    with smtplib.SMTP("localhost") as server:
        server.send_message(message)


def suggest_next():
    """Suggest the highest-priority pending task, or None if all are done."""
    pending = pending_tasks()
    return pending[0] if pending else None


def main():
    """Run a short demonstration."""
    add_task("Submit lab report", "high")
    add_task("Buy groceries")
    add_task("Call plumber", "low")
    add_task("Book train tickets", "high")
    complete_task(2)
    complete_task(99)
    print("Pending tasks:", pending_tasks())
    print("Task id for 'plumber':", find_task("plumber"))
    print("Task id for 'gym':", find_task("gym")) # returns None silently
    suggestion = suggest_next()
    print("Try this next:", suggestion)
    save_tasks()
    restored = load_tasks()
    print("Tasks restored from file:",len(restored))
    export_json()
    print("Exported tasks to tasks.json")


if __name__ == "__main__":
    main()
