
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export interface Level {
  name: 'Low' | 'Normal' | 'High' | 'Critical';
  color: string; // Tailwind color class e.g., 'text-blue-500' or 'fill-blue-500'
  bgColor: string; // Tailwind bg color class e.g., 'bg-blue-500'
  value: number;
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
}

const Needle = ({ value, cx, cy, iR, oR, color, angle }: any) => {
  const needleRadius = (oR - iR) / 2 + iR;
  const length = oR - iR;
  const needleAngle = 180 + angle;
  const x1 = cx + needleRadius * Math.cos((needleAngle * Math.PI) / 180);
  const y1 = cy + needleRadius * Math.sin((needleAngle * Math.PI) / 180);
  const x2 = cx + (needleRadius + length / 5) * Math.cos((needleAngle * Math.PI) / 180);
  const y2 = cy + (needleRadius + length / 5) * Math.sin((needleAngle * Math.PI) / 180);

  return (
    <>
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
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
}) => {
  const totalValue = levels.reduce((acc, level) => acc + level.value, 0);
  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = percentage * 180;

  const activeLevel = levels.slice().reverse().find(l => value >= l.value) || levels[0];

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
        <Icon className={cn("h-5 w-5", activeLevel.color)} />
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center flex-grow">
        <div className="w-full h-28 -mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={levels}
                dataKey="value"
                cx="50%"
                cy="90%"
                startAngle={180}
                endAngle={0}
                innerRadius="70%"
                outerRadius="100%"
                paddingAngle={2}
                isAnimationActive={false}
              >
                {levels.map((entry, index) => (
                  <Cell key={`cell-${index}`} className={cn(entry.bgColor, 'opacity-30')} />
                ))}
              </Pie>
              <Pie
                data={[{ value: 1 }]}
                dataKey="value"
                cx="50%"
                cy="90%"
                startAngle={180}
                endAngle={0}
                innerRadius="70%"
                outerRadius="100%"
                activeIndex={0}
                activeShape={(props: any) => <Needle {...props} angle={angle} color={activeLevel.color.replace('text-', 'fill-')} />}
                isAnimationActive={false}
                stroke="none"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center -mt-2">
          <p className="text-3xl font-bold">{displayValue}</p>
          <p className="text-sm text-muted-foreground">{unit}</p>
          <div className="flex items-center justify-center mt-2">
            <span className={cn('h-2.5 w-2.5 rounded-full mr-2', activeLevel.bgColor)}></span>
            <span className={cn('font-semibold text-sm', activeLevel.color)}>{activeLevel.name}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

