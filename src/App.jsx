import { useState, useEffect } from 'react';
import { IoMusicalNotes } from 'react-icons/io5';
import { AiOutlinePlus } from 'react-icons/ai';
import './App.css';

function App({ gameState, onSongSelect, onGameStart }) {
  const [showMenu, setShowMenu] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [started, setStarted] = useState(false);

  // Update UI from game state
  useEffect(() => {
    const interval = setInterval(() => {
      setScore(gameState.score);
      setCombo(gameState.combo);
      setStarted(gameState.started);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [gameState]);

  const handleSongSelect = (song) => {
    setShowMenu(false);
    setShowStart(true);
    onSongSelect(song);
  };

  const handleStartGame = () => {
    setShowStart(false);
    onGameStart();
  };

  // Listen for Space key to start
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && showStart && !started) {
        e.preventDefault();
        handleStartGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showStart, started]);

  return (
    <>
      {/* HUD - Always visible during gameplay */}
      {started && (
        <div className="hud">
          <div className="score">Score: {score}</div>
          <div className="combo">
            {combo > 0 && `${combo}x Combo!`}
          </div>
        </div>
      )}

      {/* Song Selection Menu */}
      {showMenu && (
        <div className="song-menu">
          <div className="menu-container">
            <h1>Select a Song</h1>
            <div className="song-grid">
              <button
                className="song-button"
                onClick={() => handleSongSelect('easy')}
              >
                <IoMusicalNotes className="icon" />
                <div className="artist">Easy Beat</div>
              </button>

              <button
                className="song-button"
                onClick={() => handleSongSelect('medium')}
              >
                <IoMusicalNotes className="icon" />
                <div className="artist">Medium Groove</div>
              </button>

              <button
                className="song-button"
                onClick={() => handleSongSelect('hard')}
              >
                <IoMusicalNotes className="icon" />
                <div className="artist">Hard Rush</div>
              </button>

              <button
                className="song-button"
                onClick={() => handleSongSelect('custom')}
              >
                <AiOutlinePlus className="icon" />
                <div className="artist">Custom Song</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {showStart && !started && (
        <div className="start-screen">
          <h1>Rhythm Game</h1>
          <p>Press D, F, J, K when notes reach the bottom</p>
          <p className="start-hint">Press SPACE to start</p>
        </div>
      )}
    </>
  );
}

export default App;

