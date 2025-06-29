"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Footprints, HeartPulse, ListChecks, Pill, Dumbbell } from "lucide-react"

export function Dashboard() {
  const healthStats = [
    { title: "Steps Taken", value: "8,234", icon: Footprints, change: "+12% from yesterday" },
    { title: "Heart Rate", value: "72 bpm", icon: HeartPulse, change: "Resting average" },
  ]

  const upcomingTasks = [
    { text: "Take morning medication", icon: Pill, time: "8:00 AM" },
    { text: "30-minute walk", icon: Dumbbell, time: "9:00 AM" },
    { text: "Check blood pressure", icon: HeartPulse, time: "12:00 PM" },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {healthStats.map((stat, index) => (
          <Card key={index} className="transition-transform hover:scale-[1.02] hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            <span>Upcoming Tasks</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {upcomingTasks.map((task, index) => (
              <li key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                <div className="flex items-center gap-4">
                  <task.icon className="h-6 w-6 text-primary" />
                  <span className="font-medium">{task.text}</span>
                </div>
                <span className="text-sm text-muted-foreground">{task.time}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
