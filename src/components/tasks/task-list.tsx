
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Apple, GlassWater, HeartPulse, Move } from "lucide-react";
import { useProfile } from '@/context/profile-provider';
import { useAuth } from '@/context/auth-provider';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

interface Task {
  id: string;
  text: string;
  iconName: keyof typeof TaskIcons;
  completed: boolean;
}

const TaskIcons = {
    HeartPulse,
    GlassWater,
    Move,
    Apple,
};

const defaultTasksRaw: Omit<Task, 'id' | 'completed' | 'iconName'>[] = [
    { text: 'Take your blood pressure', iconName: 'HeartPulse' },
    { text: 'Drink a glass of water', iconName: 'GlassWater' },
    { text: 'Stretch for 5 minutes', iconName: 'Move' },
    { text: 'Eat fruits', iconName: 'Apple' },
];

export function TaskList() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [isClient, setIsClient] = React.useState(false);
  const { activeProfile } = useProfile();
  const { user } = useAuth();
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (!isClient || !user || !activeProfile) {
        setTasks([]);
        return;
    }
    
    const tasksCollectionRef = collection(db, `users/${user.uid}/profiles/${activeProfile.id}/tasks`);

    const initializeTasks = async () => {
        const batch = writeBatch(db);
        const newTasks: Task[] = [];
        defaultTasksRaw.forEach((task, index) => {
            const id = `task${index + 1}`;
            const taskData = { ...task, completed: false };
            batch.set(doc(tasksCollectionRef, id), taskData);
            newTasks.push({ ...taskData, id });
        });
        await batch.commit();
        setTasks(newTasks);
    };

    const fetchTasks = async () => {
        const querySnapshot = await getDocs(tasksCollectionRef);
        if (querySnapshot.empty) {
            await initializeTasks();
        } else {
            const fetchedTasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
            setTasks(fetchedTasks);
        }
    };
    
    fetchTasks().catch(error => console.error("Error fetching tasks:", error));

  }, [isClient, user, activeProfile]);

  const handleTaskToggle = async (taskId: string) => {
    if (!user || !activeProfile) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompletedStatus = !task.completed;
    const taskDocRef = doc(db, `users/${user.uid}/profiles/${activeProfile.id}/tasks`, taskId);
    
    try {
        await updateDoc(taskDocRef, { completed: newCompletedStatus });
        setTasks(tasks.map(t =>
          t.id === taskId ? { ...t, completed: newCompletedStatus } : t
        ));
    } catch (error) {
        console.error("Error updating task:", error);
    }
  };

  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (!isClient || !activeProfile) {
    return null;
  }

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
          {tasks.map((task) => {
            const Icon = TaskIcons[task.iconName];
            return (
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
                    <Icon className={`w-6 h-6 transition-colors ${task.completed ? "text-muted-foreground" : "text-primary"}`} />
                    <Label
                    htmlFor={task.id}
                    id={`${task.id}-label`}
                    className={`text-base cursor-pointer transition-colors ${task.completed ? "line-through text-muted-foreground" : ""}`}
                    >
                    {task.text}
                    </Label>
                </div>
                </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  );
}
