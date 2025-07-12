
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export interface Level {
  name: string;
  color: string; // Hex color string e.g., '#22c55e'
}

interface VitalMeterProps {
  icon: LucideIcon;
  title: string;
  value: number;
  displayValue: string;
  unit: string;
  date?: string | null;
  min: number;
  max: number;
  levels: Level[];
  levelBoundaries: number[];
}

const Needle = ({ angle }: { angle: number }) => {
  return (
    <div
      className="absolute bottom-0 left-1/2 h-1/2 w-0.5 origin-bottom bg-foreground transition-transform duration-500"
      style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
    >
      <div className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 rounded-full border-2 border-foreground bg-background" />
    </div>
  );
};

export const VitalMeter: React.FC<VitalMeterProps> = ({
  icon: Icon,
  title,
  value,
  displayValue,
  unit,
  date,
  min,
  max,
  levels,
  levelBoundaries
}) => {
  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = percentage * 180 - 90;

  // Determine active level based on boundaries
  let activeLevelIndex = levelBoundaries.findIndex(boundary => value < boundary);
  if (activeLevelIndex === -1) {
    activeLevelIndex = levelBoundaries.length;
  }
  const activeLevel = levels[activeLevelIndex] || levels[levels.length - 1];
  
  const totalRange = max - min;
  const tickCount = 8;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
      const tickValue = min + (totalRange / tickCount) * i;
      const tickAngle = (i / tickCount) * 180 - 90;
      return { value: Math.round(tickValue), angle: tickAngle };
  });

  return (
    <Card className="bg-secondary/50 flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {date && (
            <CardDescription className="text-xs">
              {format(parseISO(date), 'MMM d, h:mm a')}
            </CardDescription>
          )}
        </div>
        <Icon className="h-5 w-5 text-foreground" style={{ color: activeLevel.color }}/>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center flex-grow pt-4">
        <div className="relative w-full max-w-[200px] aspect-video">
          <div className="absolute inset-0 overflow-hidden rounded-t-full">
            {/* Segments */}
            <div className="absolute inset-0 flex">
              {levels.map((level, index) => (
                <div
                  key={level.name}
                  className="flex-1"
                  style={{ backgroundColor: level.color }}
                />
              ))}
            </div>
            {/* White overlay to create the arc */}
            <div className="absolute top-1/2 left-1/2 h-full w-full -translate-x-1/2 -translate-y-px rounded-full bg-secondary/50" />
          </div>
          
          {/* Ticks */}
           {ticks.map((tick) => (
            <div
              key={tick.value}
              className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2"
              style={{ transform: `rotate(${tick.angle}deg)` }}
            >
              <div className="h-2 w-px bg-muted-foreground/50" />
            </div>
          ))}

          <Needle angle={angle} />
        </div>
        <div className="text-center -mt-4">
          <p className="text-3xl font-bold">{displayValue}</p>
          <p className="text-sm text-muted-foreground">{unit}</p>
          <div className="flex items-center justify-center mt-2">
            <span
              className="h-2.5 w-2.5 rounded-full mr-2"
              style={{ backgroundColor: activeLevel.color }}
            />
            <span
              className="font-semibold text-sm"
              style={{ color: activeLevel.color }}
            >
              {activeLevel.name}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
