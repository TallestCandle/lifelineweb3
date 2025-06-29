"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Pill, Dumbbell, CalendarClock } from "lucide-react";

const initialTasks = [
  { id: "task1", text: "Take morning medication", icon: Pill, time: "8:00 AM", completed: true },
  { id: "task2", text: "Go for a 30-minute walk", icon: Dumbbell, time: "9:00 AM", completed: false },
  { id: "task3", text: "Dr. Smith appointment", icon: CalendarClock, time: "2:00 PM", completed: false },
  { id: "task4", text: "Evening stretching routine", icon: Dumbbell, time: "7:00 PM", completed: false },
  { id: "task5", text: "Take evening medication", icon: Pill, time: "9:00 PM", completed: false },
];

export function TaskList() {
  const [tasks, setTasks] = useState(initialTasks);

  const handleTaskToggle = (taskId: string) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Health Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center space-x-4 p-4 rounded-lg transition-colors hover:bg-secondary/50">
              <div className="flex items-center flex-grow space-x-4">
                <Checkbox
                  id={task.id}
                  checked={task.completed}
                  onCheckedChange={() => handleTaskToggle(task.id)}
                  aria-labelledby={`${task.id}-label`}
                />
                <div className="flex items-center gap-3">
                    <task.icon className="w-6 h-6 text-primary" />
                    <Label
                        htmlFor={task.id}
                        id={`${task.id}-label`}
                        className={`text-base cursor-pointer ${task.completed ? "line-through text-muted-foreground" : ""}`}
                    >
                        {task.text}
                    </Label>
                </div>
              </div>
              <div className={`text-sm font-medium ${task.completed ? "text-muted-foreground" : "text-primary"}`}>
                {task.time}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
