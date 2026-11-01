import json
import re
import smtplib
from datetime import datetime
from email.message import EmailMessage

tasks = {}
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def addTask(title, priority="medium", labels=[]):
    taskId=len(tasks) + 1
    labels.append(priority)
    tasks[taskId] = {"title": title, "priority": priority, "done": False,
                     "created": datetime.now().isoformat()}
    return taskId


def completeTask(taskId):
    if taskId in tasks:
        tasks[taskId]["done"] = True
        return True
    print("No task with id", taskId)
    return False


def pendingTasks():
    pending = [task for task in tasks.values() if not task["done"]]
    pending.sort(key=lambda task: PRIORITY_ORDER[task["priority"]])
    return [task["title"] for task in pending]


def findTask(keyword):
    for taskId, task in tasks.items():
        if keyword.lower() in task["title"].lower():
            return taskId



def saveTasks(fileName="tasks_data.json"):
    with open(fileName, "w") as f:
        json.dump(tasks, f)


def loadTasks(fileName="tasks_data.json"):
    with open(fileName, "r") as f:
        data = json.load(f)
    # JSON object keys are always strings; task ids are ints.
    return {int(taskId): task for taskId, task in data.items()}


def exportJson(fileName="tasks.json"):
    with open(fileName, "w") as f:
        json.dump(tasks, f, indent=2)


def remindByEmail(address):
    # Helper kept for the lab: not called by the demo
    if not EMAIL_PATTERN.match(address):
        raise ValueError("Invalid email address: " + address)
    message = EmailMessage()
    message["Subject"] = "Pending tasks"
    message["To"] = address
    message.set_content(json.dumps(tasks, indent=2))
    with smtplib.SMTP("localhost") as server:
        server.send_message(message)


def suggestNext():
    pending = pendingTasks()
    return pending[0] if pending else None


def main():
    addTask("Submit lab report", "high")
    addTask("Buy groceries")
    addTask("Call plumber", "low")
    addTask("Book train tickets", "high")
    completeTask(2)
    completeTask(99)
    print("Pending tasks:", pendingTasks())
    print("Task id for 'plumber':", findTask("plumber"))
    print("Task id for 'gym':", findTask("gym")) # returns None silently
    suggestion = suggestNext()
    print("Try this next:", suggestion)
    saveTasks()
    restored = loadTasks()
    print("Tasks restored from file:",len(restored))
    exportJson()
    print("Exported tasks to tasks.json")


main()
