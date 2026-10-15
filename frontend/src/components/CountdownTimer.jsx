import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export const CountdownTimer = ({ createdAt, expiryHours }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    const calculateTime = () => {
      const createdTime = new Date(createdAt).getTime();
      const expiryTime = createdTime + expiryHours * 3600 * 1000;
      const now = new Date().getTime();
      const difference = expiryTime - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, expired: false });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [createdAt, expiryHours]);

  if (timeLeft.expired) {
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        <span>Safety Window Expired</span>
      </span>
    );
  }

  const isUrgent = timeLeft.hours < 2;

  return (
    <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold ${
      isUrgent ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-warm-100 text-slate-800 border border-slate-300'
    }`}>
      <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-700' : 'text-slate-500'}`} />
      <span>
        {String(timeLeft.hours).padStart(2, '0')}h : {String(timeLeft.minutes).padStart(2, '0')}m : {String(timeLeft.seconds).padStart(2, '0')}s
      </span>
    </div>
  );
};
