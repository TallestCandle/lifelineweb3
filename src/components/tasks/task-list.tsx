"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Apple, GlassWater, HeartPulse, Move } from "lucide-react";

interface Task {
  id: string;
  text: string;
  icon: React.ElementType;
  completed: boolean;
}

const defaultTasks: Task[] = [
    { id: 'task1', text: 'Take your blood pressure', icon: HeartPulse, completed: false },
    { id: 'task2', text: 'Drink a glass of water', icon: GlassWater, completed: false },
    { id: 'task3', text: 'Stretch for 5 minutes', icon: Move, completed: false },
    { id: 'task4', text: 'Eat fruits', icon: Apple, completed: false },
];

const LOCAL_STORAGE_KEY = 'nexus-lifeline-tasks';

export function TaskList() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
    try {
      const storedTasks = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedTasks) {
        setTasks(JSON.parse(storedTasks));
      } else {
        setTasks(defaultTasks);
      }
    } catch (error) {
      console.error("Error reading from localStorage", error);
      setTasks(defaultTasks);
    }
  }, []);
  
  React.useEffect(() => {
    if (isClient && tasks.length > 0) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
    }
  }, [tasks, isClient]);

  const handleTaskToggle = (taskId: string) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Health Tasks</CardTitle>
        <CardDescription>
          {completedTasks} of {totalTasks} tasks completed. Keep it up!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Progress value={progressPercentage} className="w-full" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              data-completed={task.completed}
              className="flex items-center space-x-4 p-4 rounded-lg transition-colors hover:bg-secondary/50 data-[completed=true]:bg-accent/20"
            >
              <Checkbox
                id={task.id}
                checked={task.completed}
                onCheckedChange={() => handleTaskToggle(task.id)}
                aria-labelledby={`${task.id}-label`}
              />
              <div className="flex items-center gap-3 flex-grow">
                <task.icon className={`w-6 h-6 transition-colors ${task.completed ? "text-muted-foreground" : "text-primary"}`} />
                <Label
                  htmlFor={task.id}
                  id={`${task.id}-label`}
                  className={`text-base cursor-pointer transition-colors ${task.completed ? "line-through text-muted-foreground" : ""}`}
                >
                  {task.text}
                </Label>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
