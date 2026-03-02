import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import MainMenu from './pages/MainMenu';
import Game from './game/Game';
import EndGame from './pages/EndGame';
import { GameEndMsg } from '../../shared/game';

type AppScreen = 'menu' | 'game' | 'endgame';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [playerName, setPlayerName] = useState('');
  const [myId, setMyId] = useState('');
  const [endResult, setEndResult] = useState<GameEndMsg | null>(null);

  const handlePlay = (name: string) => {
    setPlayerName(name);
    setScreen('game');
  };

  const handleGameEnd = (result: GameEndMsg) => {
    setEndResult(result);
    setScreen('endgame');
  };

  const handleRematch = () => {
    setEndResult(null);
    setScreen('game');
  };

  const handleMenu = () => {
    setEndResult(null);
    setScreen('menu');
  };

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {screen === 'menu' && (
            <MainMenu onPlay={handlePlay} />
          )}
          {screen === 'game' && (
            <Game
              playerName={playerName}
              onGameEnd={handleGameEnd}
              onLeave={handleMenu}
            />
          )}
          {screen === 'endgame' && endResult && (
            <EndGame
              result={endResult}
              myId={myId}
              onRematch={handleRematch}
              onMenu={handleMenu}
            />
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
