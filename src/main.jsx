import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initGame, gameState, selectSong, startGame } from "./game.js";
import "./index.css";

// Initialize Three.js game
initGame();

// Render React UI
createRoot(document.getElementById("ui-container")).render(
  <StrictMode>
    <App
      gameState={gameState}
      onSongSelect={selectSong}
      onGameStart={startGame}
    />
  </StrictMode>
);
