import React from 'react';
import { 
  Brush, 
  Video, 
  Award, 
  Users, 
  UserPlus, 
  Code, 
  Star, 
  HeartHandshake, 
  Pencil, 
  Clapperboard 
} from 'lucide-react';
import { Badge as BadgeType } from '@shared/schema';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BadgeIconProps {
  badge: string;
  showLabel?: boolean;
  size?: number;
}

export const getBadgeIcon = (badge: string, size: number = 16) => {
  const iconProps = { size, className: "inline-block" };
  
  switch(badge) {
    case 'director':
      return <Clapperboard {...iconProps} className={`${iconProps.className} text-rose-500`} />;
    case 'guionista':
      return <Pencil {...iconProps} className={`${iconProps.className} text-amber-500`} />;
    case 'novato':
      return <UserPlus {...iconProps} className={`${iconProps.className} text-blue-500`} />;
    case 'spamero':
      return <Users {...iconProps} className={`${iconProps.className} text-red-500`} />;
    case 'dibujante':
      return <Brush {...iconProps} className={`${iconProps.className} text-green-500`} />;
    case 'animador':
      return <Video {...iconProps} className={`${iconProps.className} text-purple-500`} />;
    case 'hacker':
      return <Code {...iconProps} className={`${iconProps.className} text-slate-500`} />;
    case 'superfan':
      return <Star {...iconProps} className={`${iconProps.className} text-yellow-500`} />;
    case 'fan':
      return <HeartHandshake {...iconProps} className={`${iconProps.className} text-pink-500`} />;
    case 'masteranimador':
      return <Award {...iconProps} className={`${iconProps.className} text-indigo-500`} />;
    default:
      return <Award {...iconProps} />;
  }
};

export const getBadgeColor = (badge: string) => {
  switch(badge) {
    case 'director': return 'bg-rose-100 text-rose-800 border-rose-300';
    case 'guionista': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'novato': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'spamero': return 'bg-red-100 text-red-800 border-red-300';
    case 'dibujante': return 'bg-green-100 text-green-800 border-green-300';
    case 'animador': return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'hacker': return 'bg-slate-100 text-slate-800 border-slate-300';
    case 'superfan': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'fan': return 'bg-pink-100 text-pink-800 border-pink-300';
    case 'masteranimador': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export default function BadgeIcon({ badge, showLabel = false, size = 16 }: BadgeIconProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center ${showLabel ? 'gap-1 px-2 py-0.5 text-xs rounded-full border' : ''} ${showLabel ? getBadgeColor(badge) : ''}`}>
            {getBadgeIcon(badge, size)}
            {showLabel && <span>{badge}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{badge}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}