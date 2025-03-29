import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SlowModeContextType {
  countdown: number;
  setCountdown: (seconds: number) => void;
  startCountdown: (seconds: number) => void;
  cooldownProgress: number;
  slowModeInterval: number;
  setSlowModeInterval: (interval: number) => void;
}

const SlowModeContext = createContext<SlowModeContextType | null>(null);

interface SlowModeProviderProps {
  children: ReactNode;
  initialInterval?: number;
}

export function SlowModeProvider({ 
  children, 
  initialInterval = 0 
}: SlowModeProviderProps) {
  const [countdown, setCountdown] = useState(0);
  const [slowModeInterval, setSlowModeInterval] = useState(initialInterval);
  const [intervalId, setIntervalId] = useState<number | null>(null);
  
  // Limpiar el intervalo cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [intervalId]);
  
  // Calcular el progreso del modo lento (0-100%)
  const cooldownProgress = 
    countdown > 0 && slowModeInterval
      ? 100 - (countdown / slowModeInterval) * 100 
      : 100;
  
  // Función para iniciar la cuenta regresiva
  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    
    if (intervalId !== null) {
      window.clearInterval(intervalId);
    }
    
    const newIntervalId = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          window.clearInterval(newIntervalId);
          setIntervalId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setIntervalId(newIntervalId);
  };
  
  return (
    <SlowModeContext.Provider 
      value={{ 
        countdown, 
        setCountdown, 
        startCountdown, 
        cooldownProgress,
        slowModeInterval,
        setSlowModeInterval
      }}
    >
      {children}
    </SlowModeContext.Provider>
  );
}

export function useSlowMode() {
  const context = useContext(SlowModeContext);
  if (!context) {
    throw new Error('useSlowMode debe usarse dentro de SlowModeProvider');
  }
  return context;
}