import { useState, useEffect } from "react";

type RandomizerType =
  | "COIN_FLIP"
  | "ROULETTE"
  | "PLINKO"
  | "SPINNER"
  | "DICE_ROLL";

interface Option {
  id: string;
  text: string;
}

interface RandomizerGamesProps {
  type: RandomizerType;
  options: Option[];
  onResult: (optionId: string) => void;
  onClose: () => void;
}

interface GameChildProps {
  options: Option[];
  isAnimating: boolean;
  result: Option | null;
}

export default function RandomizerGames({
  type,
  options,
  onResult,
  onClose,
}: RandomizerGamesProps) {
  console.log(options);
  const [isAnimating, setIsAnimating] = useState(false);
  const [result, setResult] = useState<Option | null>(null);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    if (options.length === 0) return;

    // Pick winner immediately
    const winner = options[Math.floor(Math.random() * options.length)];
    setResult(winner);

    // Start animation after tiny delay
    const startTimer = setTimeout(() => setIsAnimating(true), 100);

    // Stop animation after 3 seconds
    const stopTimer = setTimeout(() => {
      setIsAnimating(false);
      setAnimationComplete(true);
    }, 3100);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(stopTimer);
    };
  }, [options]);

  const handleSubmit = () => {
    if (result) {
      onResult(result.id);
    }
  };

  return (
    <div className="randomizer-overlay">
      {/* Global keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes coinFlip {
              0% { transform: rotateY(0deg); }
              100% { transform: rotateY(1800deg); }
            }
            @keyframes plinkoBounce {
              0%, 100% { transform: translate(-50%, -50%) translateY(0); }
              20% { transform: translate(-50%, -50%) translateY(20px) translateX(-10px); }
              40% { transform: translate(-50%, -50%) translateY(-10px) translateX(15px); }
              60% { transform: translate(-50%, -50%) translateY(10px) translateX(-20px); }
              80% { transform: translate(-50%, -50%) translateY(-5px) translateX(10px); }
            }
            @keyframes diceShake {
              0% { transform: rotate(0deg); }
              20% { transform: rotate(-15deg); }
              40% { transform: rotate(15deg); }
              60% { transform: rotate(-10deg); }
              80% { transform: rotate(10deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes winnerPop {
              0% { opacity: 0; transform: scale(0.3) translateY(50px); }
              100% { opacity: 1; transform: scale(1) translateY(0); }
            }
          `,
        }}
      />

      <div className="game-stage">
        {type === "COIN_FLIP" && (
          <CoinFlip
            options={options}
            isAnimating={isAnimating}
            result={result}
          />
        )}
        {type === "ROULETTE" && (
          <Roulette
            options={options}
            isAnimating={isAnimating}
            result={result}
          />
        )}
        {type === "PLINKO" && (
          <Plinko options={options} isAnimating={isAnimating} result={result} />
        )}
        {type === "SPINNER" && (
          <Spinner
            options={options}
            isAnimating={isAnimating}
            result={result}
          />
        )}
        {type === "DICE_ROLL" && (
          <DiceRoll
            options={options}
            isAnimating={isAnimating}
            result={result}
          />
        )}
      </div>

      {animationComplete && result && (
        <div className="winner-announcement">
          <h2 className="winner-label">WINNER!</h2>
          <p className="winner-text">{result.text}</p>
        </div>
      )}

      {animationComplete && (
        <div className="action-buttons">
          <button onClick={handleSubmit} className="submit-btn">
            Submit Vote
          </button>
        </div>
      )}

      <button onClick={onClose} className="close-game-btn">
        ✕ Exit
      </button>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .randomizer-overlay {
              position: fixed;
              inset: 0;
              background: radial-gradient(circle, #1e1b4b 0%, #020617 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 9999;
              flex-direction: column;
              overflow: hidden;
              padding: 2rem;
              box-sizing: border-box;
            }
            .game-stage {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              margin-bottom: 2rem;
            }
            .winner-announcement {
              text-align: center;
              animation: winnerPop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
              margin: 1rem 0;
            }
            .winner-label {
              font-size: 3.5rem;
              color: #fbbf24;
              text-shadow: 0 0 30px rgba(251, 191, 36, 0.8);
              margin: 0;
            }
            .winner-text {
              font-size: 2.2rem;
              color: white;
              margin: 0.5rem 0 1rem;
              font-weight: bold;
            }
            .action-buttons {
              margin-top: 1rem;
            }
            .submit-btn {
              background: #fbbf24;
              color: #451a03;
              border: none;
              padding: 1rem 2rem;
              font-size: 1.3rem;
              font-weight: bold;
              border-radius: 50px;
              cursor: pointer;
              box-shadow: 0 8px 20px rgba(251, 191, 36, 0.4);
              transition: all 0.2s;
            }
            .submit-btn:hover {
              transform: translateY(-3px);
              box-shadow: 0 12px 30px rgba(251, 191, 36, 0.6);
            }
            .close-game-btn {
              position: absolute;
              top: 1.5rem;
              right: 1.5rem;
              background: rgba(255, 255, 255, 0.1);
              border: 1px solid rgba(255, 255, 255, 0.2);
              color: white;
              padding: 0.6rem 1.2rem;
              border-radius: 50px;
              cursor: pointer;
              transition: all 0.2s;
              font-size: 1rem;
            }
            .close-game-btn:hover {
              background: rgba(255, 255, 255, 0.2);
            }
          `,
        }}
      />
    </div>
  );
}

// =============== MINI GAMES ===============

function CoinFlip({ options, isAnimating, result }: GameChildProps) {
  const displayText = isAnimating ? "?" : result?.text || options[0]?.text;

  return (
    <div
      style={{
        width: "220px",
        height: "220px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "10px solid #fcd34d",
        color: "#451a03",
        fontSize: "1.8rem",
        fontWeight: "bold",
        boxShadow: "0 0 60px rgba(251, 191, 36, 0.6)",
        animation: isAnimating
          ? "coinFlip 3s cubic-bezier(0.25, 0.1, 0.25, 1)"
          : "none",
      }}
    >
      {displayText}
    </div>
  );
}

function Roulette({ options, isAnimating, result }: GameChildProps) {
  const colors = [
    "#ef4444",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#a855f7",
  ];
  const segmentAngle = 360 / options.length;
  const winnerIndex = result ? options.findIndex((o) => o.id === result.id) : 0;

  // Spin many rotations + land precisely on winner
  const spins = 5; // 5 full spins
  const finalRotation =
    spins * 360 + (winnerIndex * segmentAngle + segmentAngle / 2);

  return (
    <div style={{ position: "relative", width: "380px", height: "380px" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          border: "14px solid #1e293b",
          boxShadow: "0 0 50px rgba(0,0,0,0.8)",
          transform: `rotate(${isAnimating ? finalRotation : 0}deg)`,
          transition: isAnimating
            ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
            : "none",
        }}
      >
        {options.map((opt, i) => {
          const angle = i * segmentAngle;
          return (
            <div
              key={opt.id}
              style={{
                position: "absolute",
                width: "50%",
                height: "50%",
                left: "50%",
                top: "0",
                transformOrigin: "0 100%",
                transform: `rotate(${angle}deg)`,
                background: colors[i % colors.length],
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "25px",
                  left: "50%",
                  transform: "translateX(-50%) rotate(90deg)",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  whiteSpace: "nowrap",
                }}
              >
                {opt.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pointer at top */}
      <div
        style={{
          position: "absolute",
          top: "-10px",
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "25px solid transparent",
          borderRight: "25px solid transparent",
          borderTop: "50px solid #fbbf24",
          filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.7))",
          zIndex: 20,
        }}
      />
    </div>
  );
}

function Plinko({ options, isAnimating, result }: GameChildProps) {
  const winnerX = result
    ? (options.findIndex((o) => o.id === result.id) / options.length) * 100 +
      50 / options.length
    : 50;

  return (
    <div
      style={{
        width: "340px",
        height: "420px",
        background: "#0f172a",
        borderRadius: "16px",
        position: "relative",
        border: "6px solid #334155",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "28px",
          height: "28px",
          background: "#fbbf24",
          borderRadius: "50%",
          left: isAnimating ? "50%" : `${winnerX}%`,
          top: isAnimating ? "5%" : "88%",
          transform: "translate(-50%, -50%)",
          animation: isAnimating ? "plinkoBounce 3s ease-in" : "none",
          transition: !isAnimating
            ? "all 1.2s cubic-bezier(0.2, 0.8, 0.4, 1)"
            : "none",
          boxShadow: "0 0 25px #fbbf24",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          height: "70px",
          display: "flex",
          borderTop: "4px solid #475569",
        }}
      >
        {options.map((opt) => (
          <div
            key={opt.id}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: result?.id === opt.id ? "#fbbf24" : "#cbd5e1",
              fontWeight: result?.id === opt.id ? "bold" : "normal",
              fontSize: "1.1rem",
              background:
                result?.id === opt.id
                  ? "rgba(251, 191, 36, 0.3)"
                  : "transparent",
              borderRight: "2px solid #475569",
              transition: "all 0.5s",
            }}
          >
            {opt.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Spinner({ options, isAnimating, result }: GameChildProps) {
  const winnerIndex = result ? options.findIndex((o) => o.id === result.id) : 0;
  const segment = 360 / options.length;
  const finalRotation = 1440 + (360 - winnerIndex * segment - segment / 2); // 4 full spins + land

  return (
    <div
      style={{
        transform: `rotate(${finalRotation}deg)`,
        transition: isAnimating
          ? "transform 3s cubic-bezier(0.33, 0, 0, 1)"
          : "transform 1s ease-out",
      }}
    >
      <svg width="340" height="340" viewBox="0 0 340 340">
        <circle
          cx="170"
          cy="170"
          r="160"
          fill="none"
          stroke="#1e293b"
          strokeWidth="24"
        />
        {options.map((opt, i) => {
          const startAngle = (i * 360) / options.length - 90;
          const endAngle = ((i + 1) * 360) / options.length - 90;

          const x1 = 170 + 150 * Math.cos((startAngle * Math.PI) / 180);
          const y1 = 170 + 150 * Math.sin((startAngle * Math.PI) / 180);
          const x2 = 170 + 150 * Math.cos((endAngle * Math.PI) / 180);
          const y2 = 170 + 150 * Math.sin((endAngle * Math.PI) / 180);

          return (
            <g key={opt.id}>
              <path
                d={`M170,170 L${x1},${y1} A150,150 0 1,1 ${x2},${y2} Z`}
                fill={
                  ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"][i % 5]
                }
                stroke="#0f172a"
                strokeWidth="4"
              />
              <text
                x={
                  170 +
                  100 *
                    Math.cos((((startAngle + endAngle) / 2) * Math.PI) / 180)
                }
                y={
                  170 +
                  100 *
                    Math.sin((((startAngle + endAngle) / 2) * Math.PI) / 180)
                }
                fill="white"
                fontSize="18"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {opt.text}
              </text>
            </g>
          );
        })}
        <path
          d="M170,15 L150,60 L190,60 Z"
          fill="#fbbf24"
          stroke="#d97706"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}

function DiceRoll({ options, isAnimating, result }: GameChildProps) {
  const displayText = result
    ? result.text
    : isAnimating
    ? "..."
    : options[0]?.text;

  return (
    <div
      style={{
        width: "180px",
        height: "180px",
        background: "white",
        borderRadius: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow:
          "0 15px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(0,0,0,0.1)",
        animation: isAnimating ? "diceShake 0.6s ease-in-out infinite" : "none",
      }}
    >
      <span
        style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#1e293b" }}
      >
        {displayText}
      </span>
    </div>
  );
}
